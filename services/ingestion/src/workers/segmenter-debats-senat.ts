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

import { Prisma, PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { errorMessage } from '../utils/errors';
import {
  SenatDebatsIndexClient,
  typeDInterventionSenat,
  type SegmentDebatSenat,
} from '../sources/senat/debats-index-client';

const prisma = new PrismaClient();

/** Taille des lots : au-delà, une requête paramétrée en erreur reste illisible à déboguer. */
const LOT = 500;

/**
 * Au-delà de cette proportion de lots en échec, le run est un échec, pas un
 * succès partiel silencieux. Assez haut pour absorber un aléa isolé (verrou,
 * coupure réseau ponctuelle) sur les ~240 lots d'un run complet (119 000
 * lignes / 500) ; assez bas pour ne jamais laisser passer une panne
 * systémique (mauvais SQL, connexion perdue) sous code de sortie 0 — le
 * motif documenté dans le projet des « faux ✅ sur sources en échec ».
 */
const SEUIL_ECHEC_LOTS = 0.1;

export interface OptionsSegmentation {
  depuisAnnee?: number;
  /** Dump déjà décompressé, pour les essais en local. */
  cheminLocal?: string;
  dryRun?: boolean;
}

export interface ResultatSegmentation {
  segments: number;
  /** Interventions retrouvées par le rapprochement date + ancre, changées ou non. */
  interventionsVisees: number;
  lots: number;
  lotsEnEchec: number;
  /**
   * Lignes dont une valeur (article, section, type) a été effectivement écrite
   * PAR CETTE EXÉCUTION — un delta, jamais l'état global de la table (qui
   * inclut ce qu'un run précédent a déjà posé, et masque un run qui n'écrit
   * plus rien). En dry-run, c'est ce que le run réel modifierait.
   */
  lignesModifiees: number;
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

  const lignes = [...parCle.values()];
  const totalLots = Math.ceil(lignes.length / LOT);

  const resultat: ResultatSegmentation = {
    segments: parCle.size,
    interventionsVisees: 0,
    lots: totalLots,
    lotsEnEchec: 0,
    lignesModifiees: 0,
  };

  if (options.dryRun) {
    // Aucune écriture n'est en jeu : une erreur ici doit remonter telle
    // quelle, pas être absorbée lot par lot — un aperçu partiel serait
    // trompeur plutôt que rassurant.
    for (let i = 0; i < lignes.length; i += LOT) {
      const { visees, modifiees } = await previsualiserLot(lignes.slice(i, i + LOT));
      resultat.interventionsVisees += visees;
      resultat.lignesModifiees += modifiees;
    }
    logger.info(resultat, 'Segmentation des débats Sénat (à blanc)');
    return resultat;
  }

  for (let i = 0; i < lignes.length; i += LOT) {
    try {
      const { visees, modifiees } = await appliquerLot(lignes.slice(i, i + LOT));
      resultat.interventionsVisees += visees;
      resultat.lignesModifiees += modifiees;
    } catch (error) {
      resultat.lotsEnEchec++;
      logger.warn({ lot: i / LOT, error: errorMessage(error) }, 'Lot de segmentation non écrit');
    }
  }

  logger.info(resultat, 'Segmentation des débats Sénat terminée');

  const tauxEchec = totalLots > 0 ? resultat.lotsEnEchec / totalLots : 0;
  if (tauxEchec > SEUIL_ECHEC_LOTS) {
    throw new Error(
      `Segmentation des débats Sénat en échec : ${resultat.lotsEnEchec}/${totalLots} lots ` +
        `n'ont pas pu être écrits (> ${Math.round(SEUIL_ECHEC_LOTS * 100)} %). ` +
        `${resultat.lignesModifiees} lignes ont tout de même été modifiées avant l'arrêt.`,
    );
  }

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
const RAPPROCHEMENT = Prisma.raw(`
  i.chambre = 'senat'
  AND i.seance_id ~ '^d[0-9]{8}$'
  AND to_date(substring(i.seance_id from 2), 'YYYYMMDD') = v.date::date
  AND substring(i.source_url from '#par_([0-9]+)$') = v.ancre
`);

/** Une valeur diffère effectivement de ce qui est déjà en base — sinon écrire ne changerait rien. */
const UN_CHANGEMENT = Prisma.raw(`
  (i.article_vise IS DISTINCT FROM v.article
    OR i.code_grammaire IS DISTINCT FROM v.section
    OR i.type IS DISTINCT FROM v.type)
`);

/** Colonnes du lot, dénormalisées en tableaux parallèles pour `unnest`. */
function colonnesDuLot(lot: SegmentDebatSenat[]) {
  return {
    dates: lot.map((s) => s.date),
    ancres: lot.map((s) => s.ancre),
    articles: lot.map((s) => s.articleVise),
    sections: lot.map((s) => s.typeSection),
    types: lot.map((s) => typeDInterventionSenat(s.typeSection)),
  };
}

/**
 * Compte, sans rien écrire, ce que le lot rapprocherait (`visees`) et ce
 * qu'il modifierait réellement (`modifiees`) — un dry-run honnête montre
 * l'effet d'une écriture, pas seulement le nombre de lignes qu'elle touche.
 */
async function previsualiserLot(
  lot: SegmentDebatSenat[],
): Promise<{ visees: number; modifiees: number }> {
  const { dates, ancres, articles, sections, types } = colonnesDuLot(lot);
  const [rangee] = await prisma.$queryRaw<{ visees: bigint; modifiees: bigint }[]>`
    SELECT
      COUNT(*)::bigint AS visees,
      COUNT(*) FILTER (WHERE ${UN_CHANGEMENT})::bigint AS modifiees
    FROM unnest(
      ${dates}::text[],
      ${ancres}::text[],
      ${articles}::text[],
      ${sections}::text[],
      ${types}::text[]
    ) AS v(date, ancre, article, section, type)
    JOIN interventions i ON ${RAPPROCHEMENT}
  `;
  return { visees: Number(rangee?.visees ?? 0), modifiees: Number(rangee?.modifiees ?? 0) };
}

/**
 * Écrit le lot et rapporte, en un seul aller-retour, ce qui a été rapproché
 * (`visees`) et ce qui a réellement changé (`modifiees`) : la CTE `candidats`
 * fige les lignes jointes AVANT l'écriture, pour que la comparaison porte sur
 * la valeur d'avant, pas sur la ligne déjà mise à jour.
 */
async function appliquerLot(
  lot: SegmentDebatSenat[],
): Promise<{ visees: number; modifiees: number }> {
  const { dates, ancres, articles, sections, types } = colonnesDuLot(lot);

  const [rangee] = await prisma.$queryRaw<{ visees: bigint; modifiees: bigint }[]>`
    WITH candidats AS (
      SELECT i.id, i.article_vise, i.code_grammaire, i.type,
             v.article AS nouvel_article, v.section AS nouvelle_section, v.type AS nouveau_type
      FROM unnest(
        ${dates}::text[],
        ${ancres}::text[],
        ${articles}::text[],
        ${sections}::text[],
        ${types}::text[]
      ) AS v(date, ancre, article, section, type)
      JOIN interventions i ON ${RAPPROCHEMENT}
    ),
    maj AS (
      UPDATE interventions i
      SET article_vise = c.nouvel_article,
          code_grammaire = c.nouvelle_section,
          type = c.nouveau_type
      FROM candidats c
      WHERE i.id = c.id
        AND (i.article_vise IS DISTINCT FROM c.nouvel_article
          OR i.code_grammaire IS DISTINCT FROM c.nouvelle_section
          OR i.type IS DISTINCT FROM c.nouveau_type)
      RETURNING i.id
    )
    SELECT
      (SELECT COUNT(*) FROM candidats)::bigint AS visees,
      (SELECT COUNT(*) FROM maj)::bigint AS modifiees
  `;

  return { visees: Number(rangee?.visees ?? 0), modifiees: Number(rangee?.modifiees ?? 0) };
}
