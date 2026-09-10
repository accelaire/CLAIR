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
// La fenêtre seule ne suffit pas — le premier vote d'une séance capterait la
// discussion générale qui le précède, longue de plusieurs centaines de
// paragraphes et sans rapport avec le texte voté.

import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
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
 */
export function fenetresDeDebat(
  votes: VoteAnnonceSyceron[],
): { vote: VoteAnnonceSyceron; debut: number; fin: number }[] {
  const ordonnes = [...votes].sort((a, b) => a.ordreAbsolu - b.ordreAbsolu);
  let precedent = 0;
  return ordonnes.map((vote) => {
    const fenetre = { vote, debut: precedent, fin: vote.ordreAbsolu };
    precedent = vote.ordreAbsolu;
    return fenetre;
  });
}

/**
 * Les interventions dont ce vote est l'aboutissement.
 *
 * Il ne suffit pas d'être dans la fenêtre : encore faut-il parler du même
 * article — ou du même amendement, quand l'intervention le nomme. C'est ce
 * second critère qui écarte la discussion générale précédant le premier vote,
 * et les prises de parole sur un autre article discuté dans le même intervalle.
 */
export function interventionsDuVote(
  fenetre: { vote: VoteAnnonceSyceron; debut: number; fin: number },
  interventions: InterventionARattacher[],
): { intervention: InterventionARattacher; via: string }[] {
  const { vote, debut, fin } = fenetre;
  const retenues: { intervention: InterventionARattacher; via: string }[] = [];

  for (const i of interventions) {
    if (i.ordreAbsolu <= debut || i.ordreAbsolu > fin) continue;

    const surLAmendement =
      vote.cible !== 'article' && i.amendementsVises.some((a) => vote.numeros.includes(a));
    if (surLAmendement) {
      retenues.push({ intervention: i, via: 'amendement' });
      continue;
    }

    // À défaut du numéro d'amendement — que la plupart des paragraphes ne
    // portent pas — l'article suffit : dans la fenêtre d'un vote, parler de
    // l'article mis aux voix, c'est participer au débat qu'il conclut.
    const surLArticle =
      vote.articleVise !== null && i.articleVise !== null && i.articleVise === vote.articleVise;
    if (surLArticle) {
      retenues.push({ intervention: i, via: vote.cible === 'article' ? 'article' : 'amendement' });
    }
  }

  return retenues;
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

  const scrutins = await scrutinsDeLaSeance(seance.seanceRef);
  if (scrutins.length === 0) {
    resultat.votesSansScrutin += seance.votes.length;
    return;
  }

  const interventions = await interventionsDeLaSeance(seance.uid);
  if (interventions.length === 0) return;

  const liens: { interventionId: string; scrutinId: string; via: string }[] = [];

  for (const fenetre of fenetresDeDebat(seance.votes)) {
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

/** Les scrutins d'une séance, avec les amendements qui permettent de départager. */
async function scrutinsDeLaSeance(seanceRef: string | null): Promise<ScrutinAApparier[]> {
  if (!seanceRef) return [];
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
    WHERE s.chambre = ${CHAMBRE} AND s.seance_ref = ${seanceRef}
  `;
  return lignes;
}

/** Les interventions de fond d'une séance, dans l'ordre du compte rendu. */
async function interventionsDeLaSeance(seanceUid: string): Promise<InterventionARattacher[]> {
  const lignes = await prisma.intervention.findMany({
    where: {
      seanceUid,
      estPresidence: false,
      type: { not: 'interruption' },
    },
    select: { id: true, ordreAbsolu: true, articleVise: true, amendementsVises: true },
    orderBy: { ordreAbsolu: 'asc' },
  });
  return lignes
    .filter((l): l is typeof l & { ordreAbsolu: number } => l.ordreAbsolu !== null)
    .map((l) => ({
      id: l.id,
      ordreAbsolu: l.ordreAbsolu,
      articleVise: l.articleVise,
      amendementsVises: l.amendementsVises,
    }));
}

export default linkDebatsScrutins;
