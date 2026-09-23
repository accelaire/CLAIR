// =============================================================================
// Rattachement des débats de l'Assemblée aux scrutins qu'ils ont précédés
// =============================================================================
//
// Jusqu'ici une intervention n'était rattachée à un scrutin que si sa journée,
// ou sa séance, n'en portait qu'un seul — 120 journées sur 1 115. Partout
// ailleurs la page d'un scrutin montrait le débat de la journée entière : les
// scrutins 8434, 8433 et 8432 du 21 juillet affichaient les mêmes 458
// interventions, dont aucune ne portait sur le texte voté.
//
// Le compte rendu dit pourtant exactement ce qu'on cherche. Chaque vote y est
// annoncé au perchoir avec son numéro — « Je mets aux voix l'amendement
// no 2407 » — puis proclamé avec ses chiffres — « Nombre de votants 125 …
// Pour l'adoption 37 Contre 88 ». Ce quadruplet, dans une séance donnée,
// désigne un scrutin et un seul dans 96,3 % des cas.
//
// Reste à savoir de quel débat chaque vote est l'aboutissement. Deux critères
// s'y emploient ensemble :
//
//   - la chronologie : le débat d'un vote va de la fin du vote précédent
//     jusqu'à lui ;
//   - le sujet : l'intervention doit porter sur l'article ou l'amendement mis
//     aux voix, tel que le compte rendu le déclare sur la rubrique.
//
// Ce second critère a toutefois un plafond, que la mesure a révélé. Sur les
// 2 875 scrutins de la 17e législature restés sans débat, 2 842 avaient
// pourtant un compte rendu ce jour-là : 949 portaient sur l'ensemble d'un texte
// ou sur une motion, qui n'ont ni article ni amendement, et 1 061 sur un
// amendement que le compte rendu ne nomme jamais. Le sujet ne peut rien pour
// eux.
//
// D'où un second recours : à défaut de rattachement par le sujet, la fenêtre
// elle-même, bornée au texte en discussion. C'est un rattachement plus large,
// pas un rattachement faux — c'est bien le débat qui a précédé ce vote — et il
// se distingue des autres par son `via`, pour que la page puisse dire de quelle
// finesse elle parle.
//
// La fenêtre nue, en revanche, ne suffirait pas : sans la borne du texte, le
// premier vote d'une séance capterait tout ce qui s'est dit avant lui, y
// compris sur une autre affaire.
//
// Dernier ajustement, dicté par la façon dont la séance se tient : quand le
// président enchaîne plusieurs mises aux voix sans que personne ne parle entre
// elles, ces votes n'ont pas chacun leur débat — ils partagent celui qui a
// précédé la série. Leurs fenêtres sont donc fusionnées.

import * as fs from 'fs';
import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { errorMessage } from '../utils/errors';
import { SyceronClient } from '../sources/assemblee-nationale/syceron-client';
import type { SeanceSyceron, VoteAnnonceSyceron } from '../sources/assemblee-nationale/syceron-parser';

const prisma = new PrismaClient();

const CHAMBRE = 'assemblee';

export interface OptionsLinkDebats {
  legislature: number;
  /** Archive déjà décompressée, pour les essais en local. */
  repertoireLocal?: string;
  /** Tout mesurer sans rien écrire. */
  dryRun?: boolean;
  maxSeances?: number;
  /**
   * Refaire les séances déjà rattachées au lieu de les sauter.
   *
   * Utile après un changement de règle de rattachement ; inutile au quotidien,
   * puisqu'un compte rendu publié ne bouge plus.
   */
  refaireTout?: boolean;
  /**
   * Écrire les liens dans ce fichier plutôt qu'en base.
   *
   * Un rattachement complet représente plus de cent mille lignes ; les insérer
   * séance par séance depuis un poste distant prend des heures, là où un
   * chargement en masse du fichier prend quelques minutes. La base n'est
   * touchée qu'une fois, par un COPY.
   */
  sortie?: string;
}

export interface ResultatLinkDebats {
  seances: number;
  seancesIgnorees: number;
  misesAuxVoix: number;
  votesApparies: number;
  votesAmbigus: number;
  votesSansScrutin: number;
  liens: number;
  /** Part des liens établis par la seule fenêtre, faute de sujet commun. */
  liensParFenetre: number;
  /** Comptes rendus dont l'archive ne déclare pas la séance, bornés au jour. */
  seancesParLaJournee: number;
}

/** Un scrutin tel qu'il faut le connaître pour l'apparier à une mise aux voix. */
export interface ScrutinAApparier {
  id: string;
  votants: number;
  pour: number;
  contre: number;
  /** Numéros des amendements que le scrutin met aux voix, s'ils sont connus. */
  amendements: string[];
}

/** Une intervention candidate au rattachement. */
export interface InterventionARattacher {
  id: string;
  ordreAbsolu: number;
  articleVise: string | null;
  amendementsVises: string[];
  /** Le texte en discussion, qui borne le rattachement par la seule fenêtre. */
  texteNumero: string | null;
}

/**
 * Le scrutin que désigne une mise aux voix, s'il n'y a pas de doute.
 *
 * Les chiffres proclamés suffisent presque toujours. Quand deux scrutins d'une
 * même séance affichent le même décompte — 361 cas sur 11 253 — on départage
 * par le numéro d'amendement ; faute de quoi on renonce, un débat rattaché au
 * mauvais scrutin étant pire qu'un débat non rattaché.
 */
export function scrutinDeLaMiseAuxVoix(
  vote: VoteAnnonceSyceron,
  scrutins: ScrutinAApparier[],
): ScrutinAApparier | null {
  const r = vote.resultat;
  if (!r) return null;

  const memesChiffres = scrutins.filter(
    (s) => s.votants === r.votants && s.pour === r.pour && s.contre === r.contre,
  );
  if (memesChiffres.length === 1) return memesChiffres[0] ?? null;
  if (memesChiffres.length === 0) return null;

  const memeAmendement = memesChiffres.filter((s) =>
    s.amendements.some((a) => vote.numeros.includes(a)),
  );
  return memeAmendement.length === 1 ? memeAmendement[0] ?? null : null;
}

/**
 * Borne basse du débat de chaque mise aux voix : la fin du vote précédent.
 *
 * Les mises aux voix sont rendues dans l'ordre du compte rendu ; la première
 * d'une séance ouvre sa fenêtre au début de celle-ci.
 *
 * Une exception, quand on connaît les prises de parole : un vote entre lequel
 * et le précédent personne n'a parlé n'a pas de débat propre. Le président
 * enchaîne — « je mets aux voix l'amendement no 219… le sous-amendement
 * no 222… » — et c'est la discussion qui a précédé la série qui les porte
 * tous. Sa fenêtre remonte donc à celle du vote précédent, de proche en
 * proche jusqu'au dernier échange.
 */
export function fenetresDeDebat(
  votes: VoteAnnonceSyceron[],
  interventions: InterventionARattacher[] = [],
): { vote: VoteAnnonceSyceron; debut: number; fin: number }[] {
  const ordonnes = [...votes].sort((a, b) => a.ordreAbsolu - b.ordreAbsolu);
  const aParle = (debut: number, fin: number): boolean =>
    interventions.some((i) => i.ordreAbsolu > debut && i.ordreAbsolu <= fin);

  let votePrecedent = 0;
  let debutCourant = 0;

  return ordonnes.map((vote) => {
    // Rien n'a été dit depuis le vote précédent : ce vote n'a pas de débat
    // propre, il reprend celui de la série à laquelle il appartient.
    const propre = interventions.length === 0 || aParle(votePrecedent, vote.ordreAbsolu);
    if (propre) debutCourant = votePrecedent;
    votePrecedent = vote.ordreAbsolu;
    return { vote, debut: debutCourant, fin: vote.ordreAbsolu };
  });
}

/**
 * Une mise aux voix qui ne porte ni article ni amendement.
 *
 * Un vote sur l'ensemble d'un texte ou sur une motion n'a pas de sujet plus
 * fin que le texte lui-même : le rattachement par le sujet ne peut rien en
 * faire, et seule la fenêtre les sert.
 */
function sansSujetPrecis(vote: VoteAnnonceSyceron): boolean {
  return vote.cible === 'ensemble' || vote.cible === 'motion';
}

/**
 * Les interventions dont ce vote est l'aboutissement.
 *
 * Deux lectures s'additionnent, parce qu'elles saisissent deux moments d'un
 * même débat :
 *
 *   - le numéro d'amendement prend la défense de l'amendement, seul paragraphe
 *     que le compte rendu marque de son numéro. Une prise de parole qui nomme
 *     l'amendement mis aux voix porte sur lui, où qu'elle se trouve dans la
 *     séance : on ne la borne donc pas à la fenêtre, seulement au texte en
 *     discussion et à ce qui précède le vote. C'est ce qui rattrape les séries
 *     de sous-amendements votés en rafale, dont la défense a eu lieu avant le
 *     premier vote et dont la fenêtre est vide ;
 *   - l'article prend le reste de l'échange — les avis de la commission et du
 *     gouvernement, les réponses — qui ne nomme jamais l'amendement. Celui-là
 *     exige la fenêtre : un article est discuté sur toute une série de votes,
 *     et sans borne chacun capterait les autres.
 *
 * Quand ni l'une ni l'autre ne répond, la fenêtre seule, bornée au texte. Ce
 * dernier recours sert deux cas : le vote n'a pas de sujet plus fin que le
 * texte — l'ensemble, une motion — ou bien il en a un que le compte rendu ne
 * nomme nulle part. Dans les deux cas le débat existe, et c'est celui-là.
 *
 * Les demandes de suspension ou de seconde délibération (`autre`) n'y ont pas
 * droit : ce qui les précède ne les concerne pas.
 */
export function interventionsDuVote(
  fenetre: { vote: VoteAnnonceSyceron; debut: number; fin: number },
  interventions: InterventionARattacher[],
): { intervention: InterventionARattacher; via: string }[] {
  const { vote, debut, fin } = fenetre;
  const memeTexte = (i: InterventionARattacher): boolean =>
    vote.texteNumero === null || i.texteNumero === null || i.texteNumero === vote.texteNumero;

  // Une intervention peut répondre aux deux lectures ; on garde la plus fine.
  const retenues = new Map<string, { intervention: InterventionARattacher; via: string }>();

  if (vote.cible !== 'article' && !sansSujetPrecis(vote)) {
    for (const i of interventions) {
      if (i.ordreAbsolu > fin || !memeTexte(i)) continue;
      if (i.amendementsVises.some((a) => vote.numeros.includes(a))) {
        retenues.set(i.id, { intervention: i, via: 'amendement' });
      }
    }
  }

  const dansLaFenetre = interventions.filter((i) => i.ordreAbsolu > debut && i.ordreAbsolu <= fin);

  if (!sansSujetPrecis(vote) && vote.articleVise !== null) {
    for (const i of dansLaFenetre) {
      if (i.articleVise !== vote.articleVise || retenues.has(i.id)) continue;
      retenues.set(i.id, {
        intervention: i,
        via: vote.cible === 'article' ? 'article' : 'amendement',
      });
    }
  }

  if (retenues.size > 0) return [...retenues.values()];
  if (vote.cible === 'autre') return [];

  return dansLaFenetre
    .filter(memeTexte)
    .map((intervention) => ({ intervention, via: 'fenetre' }));
}

// =============================================================================
// MOISSON
// =============================================================================

/**
 * Rattache les débats d'une législature aux scrutins qu'ils ont précédés.
 *
 * On relit l'archive plutôt que la base : les mises aux voix sont relevées par
 * le parseur, à partir des chiffres proclamés et de l'annonce qui les précède,
 * et ce raisonnement-là ne se refait pas en SQL.
 */
export async function linkDebatsScrutins(
  options: OptionsLinkDebats,
): Promise<ResultatLinkDebats> {
  const { legislature, dryRun = false } = options;
  logger.info({ legislature, dryRun, sortie: options.sortie }, 'Rattachement des débats aux scrutins...');

  const fichier = options.sortie ? fs.createWriteStream(options.sortie) : null;

  // Un compte rendu publié ne change plus : une séance déjà rattachée n'a
  // aucune raison d'être refaite, et les relire toutes chaque nuit coûterait
  // au cron plusieurs heures pour ne rien produire.
  const dejaFaites = options.refaireTout
    ? new Set<string>()
    : await seancesDejaRattachees(legislature);
  logger.info({ dejaRattachees: dejaFaites.size }, 'Séances déjà rattachées');

  const client = new SyceronClient(legislature);
  const resultat: ResultatLinkDebats = {
    seances: 0,
    seancesIgnorees: dejaFaites.size,
    misesAuxVoix: 0,
    votesApparies: 0,
    votesAmbigus: 0,
    votesSansScrutin: 0,
    liens: 0,
    liensParFenetre: 0,
    seancesParLaJournee: 0,
  };

  for await (const seance of client.seances({
    ignorer: dejaFaites,
    maxSeances: options.maxSeances,
    repertoireLocal: options.repertoireLocal,
  })) {
    try {
      await traiterSeance(seance, dryRun, resultat, fichier);
      resultat.seances++;
    } catch (error) {
      logger.warn({ seance: seance.uid, error: errorMessage(error) }, 'Séance non rattachée');
    }
  }

  if (fichier) {
    fichier.end();
    await new Promise<void>((resoudre) => fichier.on('finish', () => resoudre()));
  }

  logger.info(resultat, 'Rattachement des débats terminé');
  return resultat;
}

async function traiterSeance(
  seance: SeanceSyceron,
  dryRun: boolean,
  resultat: ResultatLinkDebats,
  fichier: fs.WriteStream | null,
): Promise<void> {
  if (seance.votes.length === 0) return;
  resultat.misesAuxVoix += seance.votes.length;

  const perimetre = perimetreDuCompteRendu(seance);
  if (perimetre.seanceRef === null) resultat.seancesParLaJournee++;

  const scrutins = await scrutinsDeLaSeance(perimetre);
  if (scrutins.length === 0) {
    resultat.votesSansScrutin += seance.votes.length;
    return;
  }

  const interventions = await interventionsDeLaSeance(seance.uid);
  if (interventions.length === 0) return;

  const liens: { interventionId: string; scrutinId: string; via: string }[] = [];

  for (const fenetre of fenetresDeDebat(seance.votes, interventions)) {
    const scrutin = scrutinDeLaMiseAuxVoix(fenetre.vote, scrutins);
    if (!scrutin) {
      // Distinguer les deux échecs : aucun scrutin ne porte ces chiffres, ou
      // plusieurs les portent sans qu'on puisse trancher.
      const memesChiffres = scrutins.filter(
        (s) =>
          s.votants === fenetre.vote.resultat?.votants &&
          s.pour === fenetre.vote.resultat?.pour &&
          s.contre === fenetre.vote.resultat?.contre,
      );
      if (memesChiffres.length > 1) resultat.votesAmbigus++;
      else resultat.votesSansScrutin++;
      continue;
    }
    resultat.votesApparies++;

    for (const { intervention, via } of interventionsDuVote(fenetre, interventions)) {
      liens.push({ interventionId: intervention.id, scrutinId: scrutin.id, via });
    }
  }

  resultat.liens += liens.length;
  resultat.liensParFenetre += liens.filter((l) => l.via === 'fenetre').length;
  if (dryRun || liens.length === 0) return;

  if (fichier) {
    for (const l of liens) fichier.write(`${l.interventionId}\t${l.scrutinId}\t${l.via}\n`);
    return;
  }

  // Une intervention peut nourrir plusieurs scrutins — un amendement puis
  // l'article qui le porte — d'où la table de liaison plutôt qu'une colonne.
  // `skipDuplicates` rend la commande rejouable telle quelle.
  await prisma.interventionScrutin.createMany({ data: liens, skipDuplicates: true });
}

/**
 * Les séances dont les débats sont déjà rattachés à leurs scrutins.
 *
 * Le lien porte sur l'intervention ; c'est donc par elle qu'on remonte à la
 * séance. Une séance partiellement rattachée compte comme faite : ses votes
 * non appariés ne le seront pas davantage à la relecture, la règle n'ayant pas
 * changé. `--refaire-tout` sert précisément aux cas où elle change.
 */
async function seancesDejaRattachees(legislature: number): Promise<Set<string>> {
  const lignes = await prisma.$queryRaw<{ seance_uid: string }[]>`
    SELECT DISTINCT i.seance_uid
    FROM intervention_scrutin isc
    JOIN interventions i ON i.id = isc.intervention_id
    WHERE i.seance_uid LIKE ${`CRSANR5L${legislature}%`}
  `;
  return new Set(lignes.map((l) => l.seance_uid));
}

/**
 * Les scrutins candidats d'une séance, avec les amendements qui départagent.
 *
 * DEUX PÉRIMÈTRES, PARCE QUE L'ARCHIVE NE DIT PAS TOUJOURS SA SÉANCE. Les
 * comptes rendus de la 17e législature déclarent un `<seanceRef>` ; ceux de la
 * 15e ne le font pas — l'élément n'existe pas dans leur schéma. Sans lui, la
 * seule borne disponible est la journée.
 *
 * Elle suffit parce que l'appariement ne repose pas sur elle : c'est le
 * décompte proclamé qui désigne le scrutin. Mesuré sur les 4 417 scrutins de la
 * 15e législature, le quadruplet est discernable pour 4 326 d'entre eux à
 * l'échelle de la séance, et pour 4 318 à l'échelle de la journée : élargir la
 * borne coûte huit scrutins, que le worker compte comme indiscernables et
 * laisse sans débat plutôt que de trancher au hasard.
 */
async function scrutinsDeLaSeance(perimetre: PerimetreDeSeance): Promise<ScrutinAApparier[]> {
  const borne =
    perimetre.seanceRef !== null
      ? Prisma.sql`s.seance_ref = ${perimetre.seanceRef}`
      : Prisma.sql`s.date >= ${perimetre.jour.debut} AND s.date < ${perimetre.jour.fin}`;

  const lignes = await prisma.$queryRaw<
    { id: string; votants: number; pour: number; contre: number; amendements: string[] }[]
  >`
    SELECT s.id,
           s.nombre_votants AS votants,
           s.nombre_pour AS pour,
           s.nombre_contre AS contre,
           COALESCE(
             ARRAY(
               SELECT regexp_replace(a.numero, '[^0-9].*$', '')
               FROM "_AmendementToScrutin" j
               JOIN amendements a ON a.id = j."A"
               WHERE j."B" = s.id
             ),
             '{}'
           ) AS amendements
    FROM scrutins s
    WHERE s.chambre = ${CHAMBRE} AND ${borne}
  `;
  return lignes;
}

/** Le périmètre où chercher les scrutins d'un compte rendu. */
type PerimetreDeSeance =
  | { seanceRef: string; jour?: undefined }
  | { seanceRef: null; jour: { debut: Date; fin: Date } };

/**
 * Où chercher les scrutins de ce compte rendu.
 *
 * La référence de séance quand l'archive la déclare, la journée sinon. Les
 * scrutins de l'Assemblée sont datés à minuit : la journée se borne donc en
 * UTC sur la date du compte rendu.
 */
function perimetreDuCompteRendu(seance: SeanceSyceron): PerimetreDeSeance {
  if (seance.seanceRef) return { seanceRef: seance.seanceRef };
  // Getters UTC : la date du compte rendu porte l'heure de Paris dans sa partie
  // UTC (cf. dateDeSeance). Lue en heure locale, une séance ouverte à 22 h
  // basculait au lendemain sur un poste réglé sur Paris.
  const debut = new Date(
    Date.UTC(seance.date.getUTCFullYear(), seance.date.getUTCMonth(), seance.date.getUTCDate()),
  );
  const fin = new Date(debut);
  fin.setUTCDate(fin.getUTCDate() + 1);
  return { seanceRef: null, jour: { debut, fin } };
}

/** Les interventions de fond d'une séance, dans l'ordre du compte rendu. */
async function interventionsDeLaSeance(seanceUid: string): Promise<InterventionARattacher[]> {
  const lignes = await prisma.intervention.findMany({
    where: {
      seanceUid,
      estPresidence: false,
      type: { not: 'interruption' },
    },
    select: {
      id: true,
      ordreAbsolu: true,
      articleVise: true,
      amendementsVises: true,
      texteNumero: true,
    },
    orderBy: { ordreAbsolu: 'asc' },
  });
  return lignes
    .filter((l): l is typeof l & { ordreAbsolu: number } => l.ordreAbsolu !== null)
    .map((l) => ({
      id: l.id,
      ordreAbsolu: l.ordreAbsolu,
      articleVise: l.articleVise,
      amendementsVises: l.amendementsVises,
      texteNumero: l.texteNumero,
    }));
}

export default linkDebatsScrutins;
