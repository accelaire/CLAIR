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

export interface IndexDOrateurs {
  /** « thibault bazin » → id, sur le nom complet. */
  parNomComplet: Map<string, string>;
  /**
   * « bazin » → id, sur le seul patronyme, et seulement s'il est unique.
   * Les homonymes en sont retirés : mieux vaut personne que le mauvais.
   */
  parPatronyme: Map<string, string>;
}

/** Construit l'index à partir des fiches de l'Assemblée. */
export function indexerOrateurs(
  fiches: Array<{ id: string; prenom: string | null; nom: string | null }>
): IndexDOrateurs {
  const parNomComplet = new Map<string, string>();
  const patronymes = new Map<string, Set<string>>();

  for (const f of fiches) {
    if (!f.nom) continue;
    const patronyme = cleDeNom(f.nom);
    if (patronyme.length === 0) continue;

    if (f.prenom) {
      const complet = cleDeNom(`${f.prenom} ${f.nom}`);
      // Un nom complet en double (homonymie parfaite) ne résout rien non plus.
      if (parNomComplet.has(complet) && parNomComplet.get(complet) !== f.id) {
        parNomComplet.set(complet, '');
      } else {
        parNomComplet.set(complet, f.id);
      }
    }

    const vus = patronymes.get(patronyme) ?? new Set<string>();
    vus.add(f.id);
    patronymes.set(patronyme, vus);
  }

  const parPatronyme = new Map<string, string>();
  for (const [patronyme, ids] of patronymes) {
    if (ids.size === 1) parPatronyme.set(patronyme, [...ids][0]!);
  }
  for (const [complet, id] of [...parNomComplet]) {
    if (id === '') parNomComplet.delete(complet);
  }

  return { parNomComplet, parPatronyme };
}

/**
 * La fiche d'un orateur, ou `null`.
 *
 * On n'essaie jamais d'inclusion : soit la clé entière correspond, soit non.
 */
export function resoudreOrateur(nom: string | null, index: IndexDOrateurs): string | null {
  if (!nom) return null;
  const cle = cleDeNom(nom);
  if (cle.length === 0) return null;

  const complet = index.parNomComplet.get(cle);
  if (complet) return complet;

  // Un nom seul : « M. Bazin ». On ne le suit que s'il désigne une seule personne.
  if (!cle.includes(' ')) return index.parPatronyme.get(cle) ?? null;

  return null;
}

/** Sépare « Thibault Bazin » en prénom et nom, pour l'affichage. */
export function prenomEtNom(nom: string | null): { prenom: string | null; nom: string | null } {
  if (!nom) return { prenom: null, nom: null };
  const mots = nom.trim().split(/\s+/u);
  if (mots.length === 1) return { prenom: null, nom: mots[0]! };
  return { prenom: mots[0]!, nom: mots.slice(1).join(' ') };
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
  index: IndexDOrateurs
) {
  const parlementaireId = resoudreOrateur(prise.nom, index);
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

  const fiches = await prisma.parlementaire.findMany({
    where: { chambre: CHAMBRE },
    select: { id: true, prenom: true, nom: true },
  });
  const index = indexerOrateurs(fiches);
  logger.info(
    { fiches: fiches.length, nomsComplets: index.parNomComplet.size, patronymes: index.parPatronyme.size },
    'Index des orateurs de commission construit'
  );

  const reunions = await prisma.reunion.findMany({
    where: {
      compteRenduRef: { not: null },
      commission: { chambre: CHAMBRE },
      ...(options.seulement && options.seulement.length > 0
        ? { compteRenduRef: { in: options.seulement } }
        : {}),
      // Sauf réingestion, on ne relit pas ce qui est déjà en base : chaque
      // réunion coûte deux requêtes au site de l'Assemblée et un PDF.
      ...(options.reingerer ? {} : { interventions: { none: {} } }),
    },
    select: { id: true, dateDebut: true, compteRenduRef: true },
    // Les réunions récentes d'abord : ce sont elles qu'on consulte, et un run
    // interrompu aura au moins traité ce qui compte.
    orderBy: { dateDebut: 'desc' },
    ...(options.maxReunions ? { take: options.maxReunions } : {}),
  });

  logger.info(
    { reunions: reunions.length, dryRun: options.dryRun ?? false, reingerer: options.reingerer ?? false },
    'Ingestion des débats de commission AN...'
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

      const lignes = cr.prises.map((p) =>
        ligne(p, { ...reunion, compteRenduRef }, telecharge.url, index)
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
