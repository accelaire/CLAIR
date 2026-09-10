// =============================================================================
// Ingestion des débats AN depuis les comptes rendus syceron
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { errorMessage } from '../utils/errors';
import { TYPE_INTERRUPTION, TYPE_REPONSE } from '../utils/interventions';
import { SyceronClient } from '../sources/assemblee-nationale/syceron-client';
import type { PriseDeParoleSyceron, SeanceSyceron } from '../sources/assemblee-nationale/syceron-parser';

const prisma = new PrismaClient();

const CHAMBRE = 'assemblee';

/** Longueur en deçà de laquelle une prise de parole n'apporte rien à lire. */
const LONGUEUR_MINIMALE = 15;

/** Marge laissée au remplacement d'une séance, connexion distante comprise. */
const DELAI_TRANSACTION = 120_000;

/** Attente maximale d'une connexion libre dans le pool avant d'abandonner. */
const DELAI_ATTENTE = 30_000;

export interface OptionsSyceron {
  legislature: number;
  maxSeances?: number;
  /** Archive déjà décompressée, pour les essais en local. */
  repertoireLocal?: string;
  /**
   * Relire les séances déjà en base et remplacer ce qu'elles y ont écrit.
   *
   * Nécessaire après un changement de lecture du compte rendu : les lignes
   * existantes portent l'ancienne interprétation, et `skipDuplicates` les
   * laisserait telles quelles. Le remplacement se fait séance par séance, dans
   * une transaction : à aucun moment la base ne se retrouve sans ses débats,
   * et une interruption ne coûte que la séance en cours.
   */
  reingerer?: boolean;
}

export interface ResultatSyceron {
  seances: number;
  interventions: number;
  seancesIgnorees: number;
  sansParlementaire: number;
}

/**
 * Une intervention prête à écrire : une ou plusieurs prises de parole
 * consécutives du même orateur, fondues en un seul tour de parole.
 */
interface InterventionAEcrire {
  sourceUid: string;
  seanceUid: string;
  ordreAbsolu: number;
  codeGrammaire: string;
  articleVise: string | null;
  texteNumero: string | null;
  amendementsVises: string[];
  estPresidence: boolean;
  orateurRef: string | null;
  orateurNom: string;
  orateurPrenom: string | null;
  orateurQualite: string | null;
  contenu: string;
  type: string;
}

/**
 * Fond les prises de parole consécutives d'un même orateur.
 *
 * Le compte rendu découpe un tour de parole en autant de paragraphes que
 * l'orateur a fait de pauses ; les afficher séparément hacherait le propos.
 * Les paragraphes de présidence restent isolés : chacun est une charnière du
 * déroulé (« Je mets aux voix… »), et les fondre effacerait la segmentation.
 */
export function regrouperPrises(prises: PriseDeParoleSyceron[]): InterventionAEcrire[] {
  const groupes: InterventionAEcrire[] = [];
  // Le tour de parole en cours : le dernier propos de fond, qu'une interruption
  // ne clôt pas. -1 quand aucun tour n'est ouvert.
  let tourEnCours = -1;

  for (const prise of prises) {
    const type = typeDIntervention(prise);
    const estInterruption = type === TYPE_INTERRUPTION;
    const precedent = tourEnCours >= 0 ? groupes[tourEnCours] : undefined;
    // Le type doit concorder : un orateur peut interrompre juste avant ou
    // juste après avoir eu la parole, et fondre les deux ferait passer son
    // chahut pour du propos de fond — ou l'inverse, sortirait une vraie
    // intervention des compteurs sous le type de l'interruption.
    const memeTour =
      !estInterruption &&
      precedent !== undefined &&
      !prise.estPresidence &&
      !precedent.estPresidence &&
      precedent.type === type &&
      memeOrateur(precedent, prise) &&
      precedent.articleVise === prise.articleVise;

    if (memeTour && precedent) {
      precedent.contenu = `${precedent.contenu}\n\n${prise.contenu}`.trim();
      continue;
    }

    groupes.push({
      sourceUid: prise.sourceUid,
      seanceUid: '',
      ordreAbsolu: prise.ordreAbsolu,
      codeGrammaire: prise.codeGrammaire,
      articleVise: prise.articleVise,
      texteNumero: prise.texteNumero,
      amendementsVises: prise.amendementsVises,
      estPresidence: prise.estPresidence,
      orateurRef: prise.orateurRef,
      orateurNom: prise.orateurNom,
      orateurPrenom: prise.orateurPrenom,
      orateurQualite: prise.orateurQualite,
      contenu: prise.contenu,
      type,
    });

    // Ce qui clôt un tour de parole, et ce qui ne le clôt pas.
    //
    // Une interruption traverse le propos sans l'interrompre vraiment : le
    // compte rendu coupe le discours en autant de paragraphes qu'on a crié
    // dessus, si bien qu'un député chahuté comptait quarante-cinq
    // « interventions » là où il en avait prononcé une. Son activité mesurée
    // dépendait du comportement des autres — et les plus chahutés sont ceux
    // des groupes qui polarisent.
    //
    // La présidence, elle, clôt : elle ne reprend la parole que pour donner la
    // suite, rappeler au règlement ou mettre aux voix.
    if (prise.estPresidence) tourEnCours = -1;
    else if (!estInterruption) tourEnCours = groupes.length - 1;
  }

  return groupes.filter((g) => g.estPresidence || g.contenu.length >= LONGUEUR_MINIMALE);
}

/**
 * Deux prises consécutives sont-elles du même orateur ?
 *
 * Les députés se reconnaissent à leur `orateurRef`. Les membres du
 * gouvernement n'en ont pas — ils ne sont pas députés — et sans eux le
 * Premier ministre voyait son discours haché en autant de blocs que de
 * paragraphes : 90 pour une seule séance.
 *
 * Pour eux on se rabat sur le nom, mais seulement s'il porte une qualité :
 * le compte rendu attribue aussi des paroles collectives (« députés du groupe
 * SOC »), qui n'ont pas de qualité et recouvrent plusieurs personnes. Les
 * fondre reviendrait à prêter à quelqu'un les mots d'un autre.
 */
function memeOrateur(
  precedent: InterventionAEcrire,
  prise: PriseDeParoleSyceron,
): boolean {
  if (precedent.orateurRef !== null || prise.orateurRef !== null) {
    return precedent.orateurRef !== null && precedent.orateurRef === prise.orateurRef;
  }
  return (
    !!precedent.orateurQualite &&
    precedent.orateurNom === prise.orateurNom &&
    precedent.orateurQualite === prise.orateurQualite
  );
}

/**
 * Le type se lit dans le code de grammaire, pas dans le texte.
 *
 * L'ancien parseur DILA classait en « question » toute intervention contenant
 * le mot « question », et en « explication_vote » toute mention d'explication
 * de vote — y compris quand l'orateur ne faisait qu'y faire allusion.
 *
 * Les interruptions sont typées à part : le compte rendu les publie comme des
 * paragraphes nominatifs (« Quel scandale ! »), soit 20 % du corpus. Ce sont
 * de vraies prises de parole, qu'on garde, mais les mêler aux interventions de
 * fond gonflerait l'activité d'un député de plusieurs milliers de lignes de
 * chahut. Elles se lisent à part — voir INTERVENTIONS_DE_FOND côté API.
 */
/**
 * Les trois formats de questions du compte rendu : au Gouvernement, orales
 * sans débat, au Premier ministre. Le corpus de la 17e législature n'en
 * connaît pas d'autres.
 */
const PREFIXES_QUESTION = ['QG_', 'QOSD_', 'QPM_'];

function estUneQuestion(code: string | null): boolean {
  return code !== null && PREFIXES_QUESTION.some((prefixe) => code.startsWith(prefixe));
}

/**
 * Une qualité de membre du Gouvernement.
 *
 * Sert à distinguer, sous une rubrique de questions, celui qui interroge de
 * celui qui répond : la rubrique vaut pour toute la séquence, si bien que sans
 * cette distinction les réponses des ministres tombaient dans leur propre
 * compteur de questions posées — 745 pour Gabriel Attal, dont 539 prononcées
 * comme Premier ministre.
 *
 * Les limites de mot autour de « ministre » ne sont pas décoratives : 562
 * paragraphes ont pour qualité « rapporteur de la commission des lois
 * constitutionnelles, de la législation et de l'administration générale de la
 * République », où « administration » contient la sous-chaîne. Ce sont des
 * députés, et les compter comme gouvernement effacerait leurs questions.
 */
const QUALITE_GOUVERNEMENT =
  /\bministres?\b|\bsecr[ée]taire\s+d[’']?[EÉ]tat\b|\bgarde\s+des\s+sceaux\b|\bporte-parole\s+du\s+gouvernement\b/i;

export function estMembreDuGouvernement(qualite: string | null): boolean {
  return qualite !== null && QUALITE_GOUVERNEMENT.test(qualite);
}

function typeDIntervention(prise: PriseDeParoleSyceron): string {
  const code = prise.codeGrammaire;
  if (code.startsWith('INTERRUPTION')) return TYPE_INTERRUPTION;
  if (code.startsWith('EXPL_VOTE') || code.startsWith('EXPLICATION')) return 'explication_vote';
  // L'Assemblée ne code pas ses explications de vote : elles ne se
  // reconnaissent qu'à l'annonce faite au perchoir, que le parseur suit d'un
  // orateur à l'autre jusqu'au scrutin.
  if (prise.dansExplicationDeVote) return 'explication_vote';
  // Une question se reconnaît soit sur le paragraphe, soit — le plus souvent —
  // sur la rubrique qui l'englobe : les paragraphes d'une séance de questions
  // portent un code générique, et sans la rubrique elle ressemblerait à
  // n'importe quel débat.
  if (code.startsWith('QUESTION') || estUneQuestion(code) || estUneQuestion(prise.codeRubrique)) {
    return estMembreDuGouvernement(prise.orateurQualite) ? TYPE_REPONSE : 'question';
  }
  return 'intervention';
}

/**
 * Moissonne les comptes rendus d'une législature.
 *
 * Par défaut on ne relit que les séances absentes de la base : l'archive est
 * republiée en entier chaque nuit, mais son passé ne bouge pas.
 */
export async function syncInterventionsSyceron(options: OptionsSyceron): Promise<ResultatSyceron> {
  const { legislature } = options;
  logger.info({ legislature, maxSeances: options.maxSeances }, 'Ingestion des débats AN (syceron)...');

  const parlementaireParRef = await chargerParlementaires();

  const dejaEnBase = options.reingerer ? new Set<string>() : await seancesDejaEnBase(legislature);
  logger.info({ dejaEnBase: dejaEnBase.size }, 'Séances déjà ingérées');

  const client = new SyceronClient(legislature);
  const resultat: ResultatSyceron = {
    seances: 0,
    interventions: 0,
    seancesIgnorees: dejaEnBase.size,
    sansParlementaire: 0,
  };

  for await (const seance of client.seances({
    ignorer: dejaEnBase,
    maxSeances: options.maxSeances,
    repertoireLocal: options.repertoireLocal,
  })) {
    try {
      const ecrites = await ecrireSeance(seance, parlementaireParRef, options.reingerer ?? false);
      resultat.seances++;
      resultat.interventions += ecrites.ecrites;
      resultat.sansParlementaire += ecrites.sansParlementaire;
    } catch (error) {
      logger.warn({ seance: seance.uid, error: errorMessage(error) }, 'Séance non écrite');
    }
  }

  logger.info(resultat, 'Ingestion des débats AN terminée');
  return resultat;
}

async function chargerParlementaires(): Promise<Map<string, string>> {
  const parlementaires = await prisma.parlementaire.findMany({
    where: { chambre: CHAMBRE },
    select: { id: true, sourceId: true },
  });
  const parRef = new Map<string, string>();
  for (const p of parlementaires) {
    if (p.sourceId) parRef.set(p.sourceId, p.id);
  }
  logger.info({ parlementaires: parRef.size }, 'Parlementaires AN chargés');
  return parRef;
}

async function seancesDejaEnBase(legislature: number): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ seance_uid: string }[]>`
    SELECT DISTINCT seance_uid
    FROM interventions
    WHERE seance_uid IS NOT NULL
      AND seance_uid LIKE ${`CRSANR5L${legislature}%`}
  `;
  return new Set(rows.map((r: { seance_uid: string }) => r.seance_uid));
}

async function ecrireSeance(
  seance: SeanceSyceron,
  parlementaireParRef: Map<string, string>,
  remplacer: boolean,
): Promise<{ ecrites: number; sansParlementaire: number }> {
  const groupes = regrouperPrises(seance.prises);
  if (groupes.length === 0) return { ecrites: 0, sansParlementaire: 0 };

  let sansParlementaire = 0;

  const lignes = groupes.map((g) => {
    const parlementaireId = g.orateurRef ? parlementaireParRef.get(g.orateurRef) ?? null : null;
    // Ministres et invités n'ont pas de fiche de parlementaire : c'est attendu,
    // leurs nom et qualité suffisent à les afficher.
    if (!parlementaireId && !g.orateurQualite && !g.estPresidence) sansParlementaire++;
    return {
      parlementaireId,
      orateurNom: g.orateurNom,
      orateurPrenom: g.orateurPrenom,
      orateurQualite: g.orateurQualite,
      chambre: CHAMBRE,
      seanceId: seance.seanceRef,
      seanceUid: seance.uid,
      date: seance.date,
      ordre: g.ordreAbsolu,
      ordreAbsolu: g.ordreAbsolu,
      codeGrammaire: g.codeGrammaire,
      articleVise: g.articleVise,
      texteNumero: g.texteNumero,
      amendementsVises: g.amendementsVises,
      estPresidence: g.estPresidence,
      type: g.type,
      contenu: g.contenu,
      sourceUid: g.sourceUid,
      sourceUrl: urlDeSeance(seance),
    };
  });

  // `skipDuplicates` sur `source_uid` : une séance déjà ingérée ne produit rien,
  // ce qui rend la commande rejouable sans précaution particulière.
  if (!remplacer) {
    const { count } = await prisma.intervention.createMany({ data: lignes, skipDuplicates: true });
    return { ecrites: count, sansParlementaire };
  }

  // Réingestion : l'ancienne lecture de la séance cède la place à la nouvelle
  // d'un seul tenant. La transaction garantit qu'on ne laisse jamais la séance
  // à moitié écrite, et le `scrutin_id` posé par le linker se repose au
  // rattachement suivant.
  const count = await prisma.$transaction(
    async (tx) => {
      await tx.intervention.deleteMany({ where: { seanceUid: seance.uid } });
      const { count: ecrites } = await tx.intervention.createMany({ data: lignes });
      return ecrites;
    },
    // Prisma ferme une transaction interactive au bout de 5 secondes par
    // défaut, ce qui suffit à la plupart des séances mais pas aux plus
    // chargées : une séance de plus de deux mille paragraphes, à remplacer sur
    // une base distante, dépasse la seconde de marge. La transaction faisait
    // alors un rollback propre — la séance gardait son ancienne lecture, sans
    // rien perdre, mais sans être corrigée non plus.
    { timeout: DELAI_TRANSACTION, maxWait: DELAI_ATTENTE },
  );
  return { ecrites: count, sansParlementaire };
}

/** Page publique du compte rendu, pour renvoyer le lecteur à la source. */
function urlDeSeance(seance: SeanceSyceron): string {
  return `https://www.assemblee-nationale.fr/dyn/${seance.legislature}/comptes-rendus/seance/${seance.uid}`;
}
