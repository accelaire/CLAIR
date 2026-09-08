// =============================================================================
// Segmentation des débats du Sénat
// =============================================================================
//
// Le texte des interventions vient de `cri.zip`, qui ne dit pas de quoi on
// parle. L'index `debats.zip` le dit : il situe chaque prise de parole dans une
// section typée — discussion d'article, discussion générale, explications de
// vote sur l'ensemble, rappel au règlement.
//
// On rapproche les deux par la date de séance et l'ancre `par_N` du compte
// rendu, continue sur toute la journée. Sur 2025-2026, 75,9 % de nos
// interventions retrouvent ainsi leur section.

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { errorMessage } from '../utils/errors';
import {
  SenatDebatsIndexClient,
  typeDInterventionSenat,
  type SegmentDebatSenat,
} from '../sources/senat/debats-index-client';

const prisma = new PrismaClient();

/** Taille des lots d'écriture : au-delà, la requête devient illisible en cas d'erreur. */
const LOT = 500;

export interface OptionsSegmentation {
  depuisAnnee?: number;
  /** Dump déjà décompressé, pour les essais en local. */
  cheminLocal?: string;
  dryRun?: boolean;
}

export interface ResultatSegmentation {
  segments: number;
  interventionsVisees: number;
  /** Interventions Sénat portant un article, après coup. */
  articlesPoses: number;
  /** Interventions Sénat reconnues comme explications de vote, après coup. */
  typesCorriges: number;
}

export async function segmenterDebatsSenat(
  options: OptionsSegmentation = {},
): Promise<ResultatSegmentation> {
  const depuisAnnee = options.depuisAnnee ?? 2024;
  logger.info({ depuisAnnee, dryRun: options.dryRun ?? false }, 'Segmentation des débats Sénat...');

  const client = new SenatDebatsIndexClient();
  const segments = await client.segments({ depuisAnnee, cheminLocal: options.cheminLocal });

  // Une même ancre ne peut relever que d'une section : en cas de doublon, on
  // garde le premier et on le signale plutôt que d'écraser en silence.
  const parCle = new Map<string, SegmentDebatSenat>();
  let collisions = 0;
  for (const s of segments) {
    const cle = `${s.date}|${s.ancre}`;
    if (parCle.has(cle)) { collisions++; continue; }
    parCle.set(cle, s);
  }
  if (collisions > 0) logger.warn({ collisions }, 'Ancres rattachées à plusieurs sections, premières retenues');

  const resultat: ResultatSegmentation = {
    segments: parCle.size,
    interventionsVisees: 0,
    articlesPoses: 0,
    typesCorriges: 0,
  };

  const lignes = [...parCle.values()];

  if (options.dryRun) {
    resultat.interventionsVisees = await compterAppariables(lignes);
    logger.info(resultat, 'Segmentation des débats Sénat (à blanc)');
    return resultat;
  }

  for (let i = 0; i < lignes.length; i += LOT) {
    try {
      resultat.interventionsVisees += await appliquerLot(lignes.slice(i, i + LOT));
    } catch (error) {
      logger.warn({ lot: i / LOT, error: errorMessage(error) }, 'Lot de segmentation non écrit');
    }
  }

  // Compté sur la base plutôt que sur les lots : c'est ce qui a réellement
  // été écrit, pas ce qu'on espérait écrire.
  const [etat] = await prisma.$queryRaw<{ articles: bigint; explications: bigint }[]>`
    SELECT COUNT(*) FILTER (WHERE article_vise IS NOT NULL)::bigint AS articles,
           COUNT(*) FILTER (WHERE type = 'explication_vote')::bigint AS explications
    FROM interventions WHERE chambre = 'senat'
  `;
  resultat.articlesPoses = Number(etat?.articles ?? 0);
  resultat.typesCorriges = Number(etat?.explications ?? 0);

  logger.info(resultat, 'Segmentation des débats Sénat terminée');
  return resultat;
}

/**
 * Prédicat de rapprochement, sur la date DE SÉANCE et l'ancre du compte rendu.
 *
 * La date est reconstruite depuis `seance_id` plutôt que lue dans `date` :
 * cette colonne a longtemps porté un décalage d'un jour (minuit local
 * enregistré en UTC), et repartir du nom du fichier de séance rend le
 * rapprochement correct que les lignes aient été recalées ou non.
 */
const RAPPROCHEMENT = `
  i.chambre = 'senat'
  AND i.seance_id ~ '^d[0-9]{8}$'
  AND to_date(substring(i.seance_id from 2), 'YYYYMMDD') = v.date::date
  AND substring(i.source_url from '#par_([0-9]+)$') = v.ancre
`;

function valeursDuLot(lot: SegmentDebatSenat[]): string {
  return lot
    .map((s) => {
      const article = s.articleVise ? `'${echapper(s.articleVise)}'` : 'NULL';
      return `('${s.date}','${s.ancre}',${article},'${echapper(s.typeSection)}','${typeDInterventionSenat(s.typeSection)}')`;
    })
    .join(',');
}

const COLONNES = 'v(date, ancre, article, section, type)';

async function compterAppariables(lignes: SegmentDebatSenat[]): Promise<number> {
  let total = 0;
  for (let i = 0; i < lignes.length; i += LOT) {
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(*)::bigint AS n
       FROM (VALUES ${valeursDuLot(lignes.slice(i, i + LOT))}) AS ${COLONNES}
       JOIN interventions i ON ${RAPPROCHEMENT}`,
    );
    total += Number(rows[0]?.n ?? 0);
  }
  return total;
}

async function appliquerLot(lot: SegmentDebatSenat[]): Promise<number> {
  return prisma.$executeRawUnsafe(`
    UPDATE interventions i
    SET article_vise = v.article::text,
        code_grammaire = v.section,
        type = v.type
    FROM (VALUES ${valeursDuLot(lot)}) AS ${COLONNES}
    WHERE ${RAPPROCHEMENT}
  `);
}

/** Les libellés du Sénat contiennent des apostrophes ; on ne construit pas de SQL sans les doubler. */
function echapper(valeur: string): string {
  return valeur.replace(/'/g, "''");
}
