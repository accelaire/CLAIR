// =============================================================================
// Ingestion des débats AN depuis les comptes rendus syceron
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { errorMessage } from '../utils/errors';
import { SyceronClient } from '../sources/assemblee-nationale/syceron-client';
import type { PriseDeParoleSyceron, SeanceSyceron } from '../sources/assemblee-nationale/syceron-parser';

const prisma = new PrismaClient();

const CHAMBRE = 'assemblee';

/** Longueur en deçà de laquelle une prise de parole n'apporte rien à lire. */
const LONGUEUR_MINIMALE = 15;

export interface OptionsSyceron {
  legislature: number;
  maxSeances?: number;
  /** Archive déjà décompressée, pour les essais en local. */
  repertoireLocal?: string;
  /** Relire les séances déjà en base au lieu de les sauter. */
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

  for (const prise of prises) {
    const precedent = groupes[groupes.length - 1];
    const memeTour =
      precedent !== undefined &&
      !prise.estPresidence &&
      !precedent.estPresidence &&
      precedent.orateurRef !== null &&
      precedent.orateurRef === prise.orateurRef &&
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
      type: typeDIntervention(prise),
    });
  }

  return groupes.filter((g) => g.estPresidence || g.contenu.length >= LONGUEUR_MINIMALE);
}

/**
 * Le type se lit dans le code de grammaire, pas dans le texte.
 *
 * L'ancien parseur DILA classait en « question » toute intervention contenant
 * le mot « question », et en « explication_vote » toute mention d'explication
 * de vote — y compris quand l'orateur ne faisait qu'y faire allusion.
 */
function typeDIntervention(prise: PriseDeParoleSyceron): string {
  const code = prise.codeGrammaire;
  if (code.startsWith('QUESTION') || code.startsWith('QG_')) return 'question';
  if (code.startsWith('EXPL_VOTE') || code.startsWith('EXPLICATION')) return 'explication_vote';
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
      const ecrites = await ecrireSeance(seance, parlementaireParRef);
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
  const { count } = await prisma.intervention.createMany({ data: lignes, skipDuplicates: true });
  return { ecrites: count, sansParlementaire };
}

/** Page publique du compte rendu, pour renvoyer le lecteur à la source. */
function urlDeSeance(seance: SeanceSyceron): string {
  return `https://www.assemblee-nationale.fr/dyn/${seance.legislature}/comptes-rendus/seance/${seance.uid}`;
}
