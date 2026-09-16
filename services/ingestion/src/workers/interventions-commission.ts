// =============================================================================
// Ingestion des prises de parole en réunion de commission — Assemblée nationale
// =============================================================================
//
// L'essentiel du travail législatif se fait en commission, et rien n'en était
// ingéré : 3 443 réunions de l'Assemblée portent une référence de compte rendu,
// aucune n'avait de contenu en base. Ce worker lit ces comptes rendus (cf.
// `sources/assemblee-nationale/compte-rendu-commission-parser.ts`) et écrit
// leurs prises de parole dans `interventions`, avec `reunion_id` posé.
//
// POURQUOI LA MÊME TABLE QUE LA SÉANCE PUBLIQUE. Même forme, même affichage,
// mêmes orateurs, même rattachement futur aux scrutins : une table jumelle
// voudrait dire dupliquer tout cela. Le prix à payer est qu'une donnée nouvelle
// arrive dans une table que beaucoup de code lit en bloc — on en a fait
// l'expérience le jour même où le Sénat est entré dans `intervention_scrutin` et
// où le seuil « liens de débat (Assemblée) » s'est mis à compter les deux
// chambres. D'où le discriminant `reunion_id`, qui reste `null` en séance
// publique : tant que les statistiques publiques (dont `stats_interventions`,
// affiché sur les 577 fiches de députés) ne l'excluent pas explicitement, elles
// continueraient de ne mesurer que l'hémicycle si on les laisse telles quelles.
// Faire compter le travail en commission dans l'activité d'un député est une
// décision éditoriale, pas une conséquence à subir.
//
// LA RÉSOLUTION DES ORATEURS. Le compte rendu de commission ne donne aucun
// identifiant, seulement un nom imprimé. On résout donc par le nom — ce qui a
// déjà coûté cher ailleurs : 46 018 amendements de l'Assemblée ont été attribués
// au mauvais député parce qu'un nom était cherché en sous-chaîne. Ici :
// comparaison de clés normalisées ENTIÈRES, jamais d'inclusion ; un nom de
// famille seul ne résout que s'il est unique dans la législature ; et une
// ambiguïté laisse `parlementaire_id` à `null` plutôt que de choisir au hasard.
// Le nom imprimé reste de toute façon affichable.
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { errorMessage } from '../utils/errors';
import { ComptesRendusCommissionClient } from '../sources/assemblee-nationale/comptes-rendus-commission-client';
import {
  parserCompteRenduCommission,
  type CompteRenduCommission,
  type PriseDeParoleCommission,
} from '../sources/assemblee-nationale/compte-rendu-commission-parser';

const prisma = new PrismaClient();

const CHAMBRE = 'assemblee';

export interface OptionsInterventionsCommission {
  /**
   * Ne regarder que les réunions tenues depuis cette date.
   *
   * La moisson nocturne s'en sert pour ne pas retester indéfiniment les
   * réunions dont le compte rendu n'a jamais été publié : elles n'ont aucune
   * prise de parole, donc le filtre incrémental les resélectionne chaque nuit.
   * Sans borne, on referait pour toujours plusieurs centaines de requêtes
   * inutiles au site de l'Assemblée — c'est exactement ce que fait déjà le
   * scraping des saisines du Sénat, 45 minutes par nuit pour rien. Le rattrapage
   * de l'historique se lance à la main, sans cette borne.
   */
  depuis?: Date;
  /** Ne traiter que ces références de compte rendu (mise au point). */
  seulement?: string[];
  /** Borne de sécurité : nombre maximum de réunions traitées. */
  maxReunions?: number;
  /** Relire les réunions déjà ingérées et remplacer leurs prises de parole. */
  reingerer?: boolean;
  /** Ne rien écrire ; compter ce qui serait écrit. */
  dryRun?: boolean;
}

export interface ResultatInterventionsCommission {
  reunionsLues: number;
  reunionsIgnorees: number;
  interventions: number;
  /** Réunions dont le compte rendu n'est pas publié, ou illisible. */
  sansCompteRendu: number;
  /** Réunions « article 86/88/91 » : pas de parole, un tableau d'avis. */
  reunionsDAmendements: number;
  /** Réunions renvoyées à la vidéo. */
  videoSeule: number;
  /** Comptes rendus d'une forme inconnue : à regarder. */
  formeInconnue: number;
  /** Prises de parole dont l'orateur n'a pas de fiche : ministres, auditionnés, ambiguïtés. */
  sansParlementaire: number;
}

// =============================================================================
// RÉSOLUTION DES ORATEURS
// =============================================================================

/**
 * Réduit un nom à une clé comparable : sans accents, sans casse, sans ponctuation.
 * « Pieyre-Alexandre Anglade » et « PIEYRE ALEXANDRE ANGLADE » donnent la même.
 */
export function cleDeNom(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/[’'\-]/gu, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

export interface FicheDOrateur {
  id: string;
  prenom: string | null;
  nom: string | null;
  /**
   * Les fenêtres de mandat parlementaire de la personne.
   *
   * Sert à départager des homonymes par la date de la réunion, jamais à
   * écarter quelqu'un — voir `resoudreOrateur`.
   */
  mandats?: Array<{ debut: Date; fin: Date | null }>;
}

/**
 * Ce que la réunion apprend sur qui peut y parler.
 *
 * Trois cercles de plus en plus étroits, tous facultatifs : on n'en a pas
 * toujours besoin, et une réunion sans commission connue doit rester lisible.
 */
export interface ContexteDeReunion {
  /** La date de la réunion : qui siégeait ce jour-là. */
  date?: Date;
  /** Les fiches des membres de la commission qui se réunit. */
  membres?: ReadonlySet<string>;
  /** Les noms complets que le compte rendu déclare présents dans la salle. */
  presents?: readonly string[];
}

export interface IndexDOrateurs {
  /**
   * « thibault bazin » → toutes les fiches qui portent ce nom complet.
   *
   * On garde la liste entière au lieu de jeter les homonymes : c'est le
   * contexte de la réunion qui tranchera, et lui seul sait le faire.
   */
  parNomComplet: Map<string, FicheDOrateur[]>;
  /** « bazin » → toutes les fiches qui portent ce patronyme. */
  parPatronyme: Map<string, FicheDOrateur[]>;
}

/** Construit l'index à partir des fiches des deux chambres. */
export function indexerOrateurs(fiches: FicheDOrateur[]): IndexDOrateurs {
  const parNomComplet = new Map<string, FicheDOrateur[]>();
  const parPatronyme = new Map<string, FicheDOrateur[]>();

  const ajouter = (index: Map<string, FicheDOrateur[]>, cle: string, fiche: FicheDOrateur) => {
    const vues = index.get(cle);
    if (!vues) index.set(cle, [fiche]);
    else if (!vues.some((f) => f.id === fiche.id)) vues.push(fiche);
  };

  for (const f of fiches) {
    if (!f.nom) continue;
    const patronyme = cleDeNom(f.nom);
    if (patronyme.length === 0) continue;

    if (f.prenom) ajouter(parNomComplet, cleDeNom(`${f.prenom} ${f.nom}`), f);
    ajouter(parPatronyme, patronyme, f);
  }

  return { parNomComplet, parPatronyme };
}

/** La personne siégeait-elle à cette date ? Sans mandat connu, on ne sait pas. */
function enMandat(fiche: FicheDOrateur, date: Date): boolean {
  return (fiche.mandats ?? []).some(
    (m) => m.debut <= date && (m.fin === null || m.fin >= date)
  );
}

/**
 * La fiche d'un orateur, ou `null`.
 *
 * DEUX RÈGLES QUI NE BOUGENT PAS. On n'essaie jamais d'inclusion : soit la clé
 * entière correspond, soit non — c'est la recherche en sous-chaîne qui avait
 * attribué 46 018 amendements au mauvais député. Et une ambiguïté qu'on ne sait
 * pas trancher rend `null` : mieux vaut personne que le mauvais.
 *
 * CE QUE LE CONTEXTE AJOUTE. Un compte rendu de 2026 ne peut pas départager
 * deux fiches à lui seul, mais la réunion, si : elle a une date, une commission
 * dont on connaît les membres, et une liste de présents imprimée en tête du
 * document. On resserre donc les candidats par cercles — qui siégeait ce
 * jour-là, qui est membre de la commission, qui était dans la salle — et on
 * s'arrête dès qu'il n'en reste qu'un. Sur nos données, la seule date fait
 * tomber les noms complets en collision de 5 à 0 et les patronymes partagés de
 * 124 à 38.
 *
 * CES CERCLES DÉPARTAGENT, ILS N'ÉCARTENT PAS. Un cercle qui viderait la liste
 * est ignoré : quand une seule fiche porte le nom, elle est la bonne, qu'elle
 * siège encore ou non — un ancien député auditionné comme expert reste la même
 * personne, et sa prise de parole lui revient.
 */
export function resoudreOrateur(
  nom: string | null,
  index: IndexDOrateurs,
  contexte: ContexteDeReunion = {}
): string | null {
  if (!nom) return null;
  const cle = cleDeNom(nom);
  if (cle.length === 0) return null;

  let candidats = index.parNomComplet.get(cle);

  if (!candidats && !cle.includes(' ')) {
    // Un patronyme nu : « M. Leseul ». La liste des présents porte les prénoms,
    // et c'est le témoignage le plus proche — elle dit qui était dans la salle
    // ce jour-là, pas seulement qui aurait pu y être.
    const complet = nomCompletParmiLesPresents(cle, contexte.presents);
    candidats = (complet && index.parNomComplet.get(complet)) || index.parPatronyme.get(cle);
  }

  if (!candidats || candidats.length === 0) return null;

  if (contexte.date) candidats = resserrer(candidats, (f) => enMandat(f, contexte.date!));
  if (contexte.membres) candidats = resserrer(candidats, (f) => contexte.membres!.has(f.id));

  return candidats.length === 1 ? candidats[0]!.id : null;
}

/** Applique un cercle, sauf s'il ne laisse personne. */
function resserrer(
  candidats: FicheDOrateur[],
  garder: (fiche: FicheDOrateur) => boolean
): FicheDOrateur[] {
  if (candidats.length <= 1) return candidats;
  const restants = candidats.filter(garder);
  return restants.length > 0 ? restants : candidats;
}

/**
 * Le nom complet d'un présent dont le patronyme est celui qu'on cherche.
 *
 * Rend `null` si deux présents le partagent : la salle ne tranche pas non plus.
 */
function nomCompletParmiLesPresents(
  patronyme: string,
  presents: readonly string[] | undefined
): string | null {
  if (!presents) return null;
  const trouves = new Set<string>();
  for (const present of presents) {
    const cle = cleDeNom(present.replace(DEBUT_CIVILITE_PRESENTS, ''));
    if (cle.endsWith(` ${patronyme}`)) trouves.add(cle);
  }
  return trouves.size === 1 ? [...trouves][0]! : null;
}

/** « M. », « Mme » en tête d'un nom de la liste des présents. */
const DEBUT_CIVILITE_PRESENTS = /^(?:MM?\.|Mmes?)\s+/u;

/** Sépare « Thibault Bazin » en prénom et nom, pour l'affichage. */
export function prenomEtNom(nom: string | null): { prenom: string | null; nom: string | null } {
  if (!nom) return { prenom: null, nom: null };
  const mots = nom.trim().split(/\s+/u);
  if (mots.length === 1) return { prenom: null, nom: mots[0]! };
  return { prenom: mots[0]!, nom: mots.slice(1).join(' ') };
}

/**
 * Les membres de chaque commission, pour départager les homonymes.
 *
 * Une seule requête pour tout le run : les listes sont petites — 28 fiches par
 * organe en moyenne — et les relire réunion par réunion coûterait une requête
 * par compte rendu sans rien apporter.
 *
 * On prend les mandats en cours plutôt que ceux du jour de la réunion : la
 * composition d'une commission bouge peu, et ce cercle ne sert qu'à trancher
 * entre des candidats que la date a déjà retenus.
 */
async function membresDesCommissions(
  commissionIds: string[]
): Promise<Map<string, Set<string>>> {
  const membresParCommission = new Map<string, Set<string>>();
  if (commissionIds.length === 0) return membresParCommission;

  const mandats = await prisma.mandat.findMany({
    where: { commissionId: { in: [...new Set(commissionIds)] }, dateFin: null },
    select: { commissionId: true, parlementaireId: true },
  });

  for (const m of mandats) {
    if (!m.commissionId) continue;
    const membres = membresParCommission.get(m.commissionId) ?? new Set<string>();
    membres.add(m.parlementaireId);
    membresParCommission.set(m.commissionId, membres);
  }
  return membresParCommission;
}

// =============================================================================
// ÉCRITURE
// =============================================================================

/**
 * Le `source_uid` d'une prise de parole de commission.
 *
 * La référence du compte rendu et le rang y suffisent : le PDF d'une réunion
 * passée ne change plus, et la contrainte d'unicité rend la commande rejouable.
 */
export function sourceUidCommission(compteRenduRef: string, ordre: number): string {
  return `${compteRenduRef}#${ordre}`;
}

function ligne(
  prise: PriseDeParoleCommission,
  reunion: { id: string; dateDebut: Date; compteRenduRef: string },
  url: string,
  index: IndexDOrateurs,
  contexte: ContexteDeReunion
) {
  const parlementaireId = resoudreOrateur(prise.nom, index, contexte);
  const { prenom, nom } = prenomEtNom(prise.nom);
  return {
    reunionId: reunion.id,
    parlementaireId,
    orateurNom: nom,
    orateurPrenom: prenom,
    orateurQualite: prise.qualite,
    orateurGroupe: prise.groupe,
    chambre: CHAMBRE,
    date: reunion.dateDebut,
    ordre: prise.ordre,
    type: 'intervention',
    contenu: prise.contenu,
    estPresidence: prise.estPresidence,
    sourceUid: sourceUidCommission(reunion.compteRenduRef, prise.ordre),
    sourceUrl: url,
  };
}

// =============================================================================
// WORKER
// =============================================================================

export async function syncInterventionsCommission(
  options: OptionsInterventionsCommission = {}
): Promise<ResultatInterventionsCommission> {
  const resultat: ResultatInterventionsCommission = {
    reunionsLues: 0,
    reunionsIgnorees: 0,
    interventions: 0,
    sansCompteRendu: 0,
    reunionsDAmendements: 0,
    videoSeule: 0,
    formeInconnue: 0,
    sansParlementaire: 0,
  };

  // Les deux chambres, pas seulement l'Assemblée : l'Office parlementaire
  // d'évaluation des choix scientifiques et technologiques et les commissions
  // mixtes paritaires siègent à l'Assemblée mais des sénateurs y prennent la
  // parole — quatre des huit orateurs du premier compte rendu lu. Élargir
  // l'index ne peut qu'ajouter des résolutions justes : un patronyme partagé
  // entre les deux chambres devient ambigu, donc cesse de résoudre.
  const fiches = await prisma.parlementaire.findMany({
    select: {
      id: true,
      prenom: true,
      nom: true,
      // La date de la réunion départage les homonymes : sur nos fiches, elle
      // fait tomber les noms complets en collision de 5 à 0 et les patronymes
      // partagés de 124 à 38.
      mandats: {
        where: { typeOrgane: { in: ['ASSEMBLEE', 'SENAT'] } },
        select: { dateDebut: true, dateFin: true },
      },
    },
  });
  const index = indexerOrateurs(
    fiches.map((f) => ({
      id: f.id,
      prenom: f.prenom,
      nom: f.nom,
      mandats: f.mandats.map((m) => ({ debut: m.dateDebut, fin: m.dateFin })),
    }))
  );
  logger.info(
    { fiches: fiches.length, nomsComplets: index.parNomComplet.size, patronymes: index.parPatronyme.size },
    'Index des orateurs de commission construit'
  );

  const reunions = await prisma.reunion.findMany({
    where: {
      // LE FILTRE PORTE SUR LA RÉFÉRENCE, ET RIEN D'AUTRE. `CRCANR…` désigne
      // exactement les comptes rendus de commission de l'Assemblée — vérifié
      // sur les 4 032 réunions qui portent une référence, sans une exception.
      // Les réunions de séance publique en portent une aussi (`CRSANR…`, 601 à
      // l'Assemblée), mais elle désigne le compte rendu de séance, déjà ingéré
      // en XML par `sync-debats-an`, et sa page de notice n'existe pas : sans
      // ce filtre on ferait 601 requêtes vouées au 404, chaque nuit. Le Sénat,
      // lui, range une URL dans ce champ.
      //
      // On a d'abord filtré sur `commission: { chambre }`. C'était un piège :
      // 28 réunions de l'Assemblée n'ont pas de `commission_id` — dont la
      // MECSS, dont le compte rendu porte 54 prises de parole — et une
      // jointure sur une clé étrangère nullable les écartait en silence.
      compteRenduRef: { startsWith: 'CRCANR' },
      ...(options.seulement && options.seulement.length > 0
        ? { compteRenduRef: { in: options.seulement } }
        : {}),
      ...(options.depuis ? { dateDebut: { gte: options.depuis } } : {}),
      // Sauf réingestion, on ne relit pas ce qui est déjà en base : chaque
      // réunion coûte deux requêtes au site de l'Assemblée et un PDF.
      ...(options.reingerer ? {} : { interventions: { none: {} } }),
    },
    select: { id: true, dateDebut: true, compteRenduRef: true, commissionId: true },
    // Les réunions récentes d'abord : ce sont elles qu'on consulte, et un run
    // interrompu aura au moins traité ce qui compte.
    orderBy: { dateDebut: 'desc' },
    ...(options.maxReunions ? { take: options.maxReunions } : {}),
  });

  logger.info(
    {
      reunions: reunions.length,
      depuis: options.depuis?.toISOString().slice(0, 10) ?? null,
      dryRun: options.dryRun ?? false,
      reingerer: options.reingerer ?? false,
    },
    'Ingestion des débats de commission AN...'
  );

  const membresParCommission = await membresDesCommissions(
    reunions.map((r) => r.commissionId).filter((id): id is string => id !== null)
  );

  const client = new ComptesRendusCommissionClient();

  for (const reunion of reunions) {
    const compteRenduRef = reunion.compteRenduRef!;
    try {
      const telecharge = await client.texteDuCompteRendu(compteRenduRef);
      if (!telecharge) {
        resultat.sansCompteRendu += 1;
        continue;
      }

      const cr: CompteRenduCommission = parserCompteRenduCommission(telecharge.texte);
      if (cr.type === 'avis_amendements') resultat.reunionsDAmendements += 1;
      if (cr.type === 'video_seule') resultat.videoSeule += 1;
      if (cr.type === 'vide') {
        resultat.formeInconnue += 1;
        logger.warn({ compteRenduRef, url: telecharge.url }, 'Compte rendu de commission de forme inconnue');
      }
      if (cr.prises.length === 0) continue;

      // Ce que cette réunion-là apprend sur qui pouvait y parler.
      const contexte: ContexteDeReunion = {
        date: reunion.dateDebut,
        membres: reunion.commissionId
          ? membresParCommission.get(reunion.commissionId)
          : undefined,
        presents: cr.presents,
      };

      const lignes = cr.prises.map((p) =>
        ligne(p, { ...reunion, compteRenduRef }, telecharge.url, index, contexte)
      );
      resultat.sansParlementaire += lignes.filter(
        (l) => l.parlementaireId === null && !l.orateurQualite && !l.estPresidence
      ).length;

      if (options.dryRun) {
        resultat.reunionsLues += 1;
        resultat.interventions += lignes.length;
        continue;
      }

      if (options.reingerer) {
        // La relecture remplace d'un seul tenant : jamais de réunion à moitié
        // écrite, même si la transaction échoue.
        await prisma.$transaction(async (tx) => {
          await tx.intervention.deleteMany({ where: { reunionId: reunion.id } });
          await tx.intervention.createMany({ data: lignes });
        });
        resultat.interventions += lignes.length;
      } else {
        const { count } = await prisma.intervention.createMany({
          data: lignes,
          skipDuplicates: true,
        });
        resultat.interventions += count;
      }
      resultat.reunionsLues += 1;
    } catch (err) {
      logger.warn(
        { compteRenduRef, error: errorMessage(err) },
        'Réunion de commission non ingérée'
      );
      resultat.sansCompteRendu += 1;
    }
  }

  logger.info(resultat, 'Ingestion des débats de commission AN terminée');
  return resultat;
}
