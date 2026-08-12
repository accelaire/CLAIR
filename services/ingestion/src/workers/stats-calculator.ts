// =============================================================================
// Stats Calculator - Calcul batch des statistiques parlementaires
// Exécuté après chaque ingestion pour pré-calculer les stats
// =============================================================================

import { PrismaClient } from '@prisma/client';
import pLimit from 'p-limit';
import { logger } from '../utils/logger';
import { errorMessage } from '../utils/errors';
import { LEGISLATURE_AN_COURANTE } from './mandats';

/**
 * Options communes des calculs de stats.
 * `includeFrozen` : recalculer AUSSI les législatures AN figées (< LEGISLATURE_AN_COURANTE).
 * Une législature révolue ne bouge plus après son one-shot d'ingestion : le batch de nuit
 * la saute par défaut (perf). On ne la repasse que juste après une ingestion historique.
 */
export interface StatsOptions {
  includeFrozen?: boolean;
}

/** Un groupe AN d'une législature révolue est figé ; le Sénat (legislature NULL) ne l'est jamais. */
function estGroupeFige(g: { legislature: number | null }): boolean {
  return g.legislature !== null && g.legislature < LEGISLATURE_AN_COURANTE;
}

const prisma = new PrismaClient();

// Pour la version legacy uniquement
const limit = pLimit(1);

export interface StatsCalculationResult {
  total: number;
  updated: number;
  errors: number;
  duration: string;
}

/**
 * Réconcilie `parlementaires.actif` avec la réalité des mandats :
 *   actif ⇔ il existe un mandat EN COURS (date_fin NULL).
 *
 * Les upserts d'ingestion posent `actif=true` à la création mais ne le rabaissent
 * pas quand un mandat se clôt en cours de route. Cas typique côté Sénat : un
 * sénateur devenu ministre cède son siège à son suppléant (une `date_fin` est
 * posée sur son mandat) mais restait `actif=true`. Côté AN le souci ne se voit pas :
 * les mandats se clôturent proprement en fin de législature.
 *
 * Idempotent, et ne touche QUE les lignes réellement incohérentes (le `WHERE`
 * compare `actif` au prédicat). Prépare la Phase 5 (où `actif` devient dérivé).
 */
export async function reconcileActifFromMandats(): Promise<{ corrected: number }> {
  const corrected = await prisma.$executeRaw`
    UPDATE parlementaires p
    SET actif = EXISTS (
      SELECT 1 FROM mandats_parlementaires m
      WHERE m.personne_id = p.id AND m.date_fin IS NULL
    )
    WHERE p.actif <> EXISTS (
      SELECT 1 FROM mandats_parlementaires m
      WHERE m.personne_id = p.id AND m.date_fin IS NULL
    )
  `;
  if (corrected > 0) {
    logger.info({ corrected }, 'Reconciled parlementaires.actif from current mandates');
  }
  return { corrected };
}

/**
 * Calcule et stocke les stats pour tous les parlementaires d'une chambre
 * VERSION OPTIMISÉE: Une seule requête SQL pour calculer toutes les stats
 */
export async function calculateAllStats(
  chambre?: 'assemblee' | 'senat',
  options: StatsOptions = {}
): Promise<StatsCalculationResult> {
  const startTime = Date.now();
  // Pour le filtre SQL: si chambre est null, on matche tout
  const chambreFilter = chambre || '%';
  const includeFrozen = options.includeFrozen ?? false;
  // Seuil de législature couvert par le recalcul per-mandat : sans `includeFrozen`,
  // on ne touche que la législature courante (les révolues sont figées). Avec, on
  // descend à 0 pour ré-embrasser tout l'historique. Le Sénat (legislature NULL)
  // n'est jamais figé — il passe dans les deux cas.
  const seuilLegislature = includeFrozen ? 0 : LEGISLATURE_AN_COURANTE;

  logger.info(
    { chambre: chambre || 'all', includeFrozen },
    'Starting stats calculation (SQL optimized)...'
  );

  try {
    // Étape 1: Calculer les stats de base (présence, participation, interventions, amendements)
    // en une seule requête SQL massive avec CTEs
    logger.info('Calculating base stats (votes, interventions, amendments)...');

    // Présence de CARRIÈRE : « couverture par personne ». Numérateur et dénominateur
    // sont bornés au MÊME ensemble — les scrutins couverts par au moins un mandat de la
    // personne — pour que le taux reste ≤ 100 %.
    //
    // Un scrutin est « couvert » par un mandat quand la personne siégeait au moment du
    // scrutin (mandat d'époque) :
    //   AN   : m.legislature = s.legislature ET s.date ∈ [date_debut, date_fin]
    //          (le fenêtrage par dates isole les mandats partiels : un député parti en
    //           cours de législature ne se voit pas attribuer les scrutins postérieurs).
    //          Garde-fou `s.legislature IS NOT NULL` : les scrutins legacy sans
    //          législature ne sont couverts par aucun mandat.
    //   Sénat: s.date ∈ [date_debut, date_fin] (pas de législature au Sénat).
    //
    // Le dénominateur compte les scrutins DISTINCTS couverts (le DISTINCT absorbe les
    // mandats qui se chevauchent — clos + rouvert au retour d'un ministre — qui
    // couvriraient sinon deux fois le même scrutin). Une personne à mandats dans les
    // deux chambres somme ses scrutins couverts AN + Sénat en une seule ligne, cohérent
    // avec le numérateur qui compte lui aussi tous chambres confondues.
    const baseStatsUpdated = await prisma.$executeRaw`
      WITH scrutins_couverts AS (
        -- Une ligne par (personne, scrutin couvert) : le DISTINCT dédoublonne les
        -- chevauchements de mandats sur un même scrutin.
        SELECT DISTINCT m.personne_id, s.id AS scrutin_id, s.type_vote
        FROM mandats_parlementaires m
        JOIN scrutins s ON s.chambre = m.chambre
          AND (
                (s.chambre = 'assemblee' AND s.legislature IS NOT NULL
                 AND m.legislature = s.legislature
                 AND s.date >= m.date_debut
                 AND (m.date_fin IS NULL OR s.date <= m.date_fin))
             OR (s.chambre = 'senat'
                 AND s.date >= m.date_debut
                 AND (m.date_fin IS NULL OR s.date <= m.date_fin))
              )
      ),
      scrutin_counts AS (
        -- Dénominateur carrière : une seule ligne par personne (SUM des deux chambres).
        SELECT personne_id,
               COUNT(*)::bigint as total,
               COUNT(*) FILTER (WHERE type_vote = 'solennel')::bigint as total_solennel
        FROM scrutins_couverts
        GROUP BY personne_id
      ),
      vote_stats AS (
        -- Numérateur borné au MÊME ensemble : seuls comptent les votes émis sur un
        -- scrutin couvert par un mandat de la personne (même prédicat que ci-dessus).
        -- Tout vote hors fenêtre (mandat mal daté / manquant) est exclu, ce qui garantit
        -- numérateur ≤ dénominateur → présence ≤ 100 %.
        SELECT
          v.parlementaire_id,
          COUNT(*) FILTER (WHERE v.position != 'absent') as votes_non_absent,
          COUNT(*) FILTER (WHERE v.position != 'absent' AND s.type_vote = 'solennel') as votes_solennel_non_absent
        FROM votes v
        JOIN scrutins s ON v.scrutin_id = s.id
        WHERE EXISTS (
          SELECT 1 FROM mandats_parlementaires m
          WHERE m.personne_id = v.parlementaire_id
            AND m.chambre = s.chambre
            AND (
                  (s.chambre = 'assemblee' AND s.legislature IS NOT NULL
                   AND m.legislature = s.legislature
                   AND s.date >= m.date_debut
                   AND (m.date_fin IS NULL OR s.date <= m.date_fin))
               OR (s.chambre = 'senat'
                   AND s.date >= m.date_debut
                   AND (m.date_fin IS NULL OR s.date <= m.date_fin))
                )
        )
        GROUP BY v.parlementaire_id
      ),
      intervention_stats AS (
        SELECT
          i.parlementaire_id,
          COUNT(*) as total_interventions,
          COUNT(*) FILTER (WHERE i.type = 'question') as total_questions
        FROM interventions i
        WHERE i.chambre LIKE ${chambreFilter}
        GROUP BY i.parlementaire_id
      ),
      amendement_stats AS (
        SELECT
          a.parlementaire_id,
          COUNT(*) as total_amendements,
          COUNT(*) FILTER (WHERE a.sort IN ('Adopté', 'adopte', 'adopte_modifie')) as total_adoptes
        FROM amendements a
        WHERE a.chambre LIKE ${chambreFilter}
        GROUP BY a.parlementaire_id
      ),
      all_stats AS (
        SELECT
          p.id,
          CASE
            WHEN sc.total > 0 THEN ROUND((COALESCE(vs.votes_non_absent, 0)::float / sc.total) * 100)
            ELSE 0
          END as new_presence,
          CASE
            WHEN sc.total_solennel > 0 THEN ROUND((COALESCE(vs.votes_solennel_non_absent, 0)::float / sc.total_solennel) * 100)
            ELSE NULL
          END as new_presence_solennel,
          COALESCE(vs.votes_non_absent, 0) as new_participation,
          COALESCE(ist.total_interventions, 0) as new_interventions,
          COALESCE(ist.total_questions, 0) as new_questions,
          COALESCE(ast.total_amendements, 0) as new_amendements,
          COALESCE(ast.total_adoptes, 0) as new_adoptes
        FROM parlementaires p
        LEFT JOIN scrutin_counts sc ON sc.personne_id = p.id
        LEFT JOIN vote_stats vs ON vs.parlementaire_id = p.id
        LEFT JOIN intervention_stats ist ON ist.parlementaire_id = p.id
        LEFT JOIN amendement_stats ast ON ast.parlementaire_id = p.id
        -- Carrière calculée pour TOUTE personne ayant au moins un mandat, anciens
        -- inclus (actif=false) : leur fiche affiche toujours la carrière (règle produit).
        -- Les classements restent bornés à actif=true en aval, donc les anciens n'y
        -- entrent pas. Un multi-mandat (sénateur revenu) cumule bien tous ses mandats.
        WHERE p.chambre LIKE ${chambreFilter}
          AND EXISTS (SELECT 1 FROM mandats_parlementaires mm WHERE mm.personne_id = p.id)
      )
      -- Ces agrégats couvrent TOUS les mandats : ils alimentent donc les colonnes
      -- de CARRIERE. Les taux (presence, loyaute, participation) sont recopies
      -- plus bas depuis le mandat EN COURS : c'est ce qui trie les listes et les
      -- classements, ou l'on ne compare que des elus d'une meme periode.
      -- Les compteurs bruts (interventions, amendements, questions) restent des
      -- totaux : ils ne dependent d'aucun denominateur de scrutins.
      UPDATE parlementaires
      SET
        stats_carriere_presence = all_stats.new_presence,
        stats_carriere_participation = all_stats.new_participation,
        stats_carriere_interventions = all_stats.new_interventions,
        stats_carriere_amendements = all_stats.new_amendements,
        stats_presence_solennel = all_stats.new_presence_solennel,
        stats_interventions = all_stats.new_interventions,
        stats_questions = all_stats.new_questions,
        stats_amendements = all_stats.new_amendements,
        stats_amendements_adoptes = all_stats.new_adoptes,
        stats_calculated_at = NOW()
      FROM all_stats
      WHERE parlementaires.id = all_stats.id
    `;

    logger.info({ updated: baseStatsUpdated }, 'Base stats calculated');

    // Étape 2: Calculer la loyauté (requête plus complexe avec window functions)
    // Exécuté séparément car très lourd
    logger.info('Calculating loyalty stats...');

    // Loyauté mesurée contre le groupe où le parlementaire siégeait AU MOMENT du
    // scrutin, et contre la majorité de CE groupe à ce moment-là. Le groupe est
    // un attribut du mandat, pas de la personne : prendre `parlementaires.groupe_id`
    // comparait les votes de la 16e à la position d'un groupe de la 17e.
    const loyaltyUpdated = await prisma.$executeRaw`
      WITH votes_epoque AS (
        SELECT
          v.parlementaire_id,
          v.scrutin_id,
          v.position,
          COALESCE(m.groupe_id, p.groupe_id) as groupe_id
        FROM votes v
        JOIN scrutins s ON v.scrutin_id = s.id
        JOIN parlementaires p ON v.parlementaire_id = p.id
        LEFT JOIN mandats_parlementaires m
          ON m.personne_id = v.parlementaire_id
          AND m.chambre = s.chambre
          AND (
                (s.chambre = 'assemblee' AND s.legislature IS NOT NULL
                 AND m.legislature = s.legislature)
             OR (s.chambre = 'senat' AND m.date_debut <= s.date
                 AND (m.date_fin IS NULL OR m.date_fin >= s.date))
              )
        WHERE v.position != 'absent'
          AND s.chambre LIKE ${chambreFilter}
      ),
      group_majority_positions AS (
        SELECT
          scrutin_id,
          groupe_id,
          position,
          ROW_NUMBER() OVER (PARTITION BY scrutin_id, groupe_id ORDER BY COUNT(*) DESC) as rn
        FROM votes_epoque
        WHERE groupe_id IS NOT NULL
        GROUP BY scrutin_id, groupe_id, position
      ),
      parlementaire_loyalty AS (
        SELECT
          ve.parlementaire_id,
          COUNT(*) as total_votes,
          COUNT(*) FILTER (WHERE ve.position = gmp.position) as loyal_votes
        FROM votes_epoque ve
        LEFT JOIN group_majority_positions gmp
          ON gmp.scrutin_id = ve.scrutin_id
          AND gmp.groupe_id = ve.groupe_id
          AND gmp.rn = 1
        WHERE ve.groupe_id IS NOT NULL
        GROUP BY ve.parlementaire_id
      )
      -- Loyauté sur TOUS les mandats → colonne de carrière (cf. supra).
      UPDATE parlementaires
      SET stats_carriere_loyaute = CASE
        WHEN pl.total_votes > 0 THEN ROUND((pl.loyal_votes::float / pl.total_votes) * 100)
        ELSE 0
      END
      FROM parlementaire_loyalty pl
      WHERE parlementaires.id = pl.parlementaire_id
        AND parlementaires.groupe_id IS NOT NULL
        AND parlementaires.chambre LIKE ${chambreFilter}
    `;

    logger.info({ updated: loyaltyUpdated }, 'Loyalty stats calculated');

    // -------------------------------------------------------------------------
    // Stats PAR MANDAT (multi-législatures — SPEC ticket #13)
    // -------------------------------------------------------------------------
    // Les stats ci-dessus décrivent la CARRIÈRE d'une personne (toutes ses
    // législatures cumulées). Elles ne peuvent donc pas décrire un groupe dissous :
    // la moyenne d'un groupe de la 16e doit porter sur les mandats de la 16e.
    //
    // On calcule ici les mêmes indicateurs, mais rapportés à chaque mandat : sa
    // période sert de dénominateur, et son propre groupe de référence.
    //
    // Périmètre : `mandats_cibles` filtre en amont les mandats à recalculer. Les
    // législatures AN révolues sont figées (leurs stats ne bougent plus après leur
    // ingestion) → sautées par défaut, sauf `includeFrozen`. Le Sénat (legislature
    // NULL) et la législature courante passent toujours. Restreindre l'ensemble ICI
    // reste correct pour la loyauté : un scrutin n'appartient qu'à une seule
    // législature, donc tous les mandats qui le couvrent partagent le même statut
    // figé/actif — la position majoritaire du groupe est toujours calculée sur
    // l'intégralité des mandats d'un scrutin donné.
    logger.info({ includeFrozen }, 'Calculating per-mandate stats...');

    const mandatStatsUpdated = await prisma.$executeRaw`
      WITH mandats_cibles AS (
        SELECT m.id, m.chambre, m.legislature, m.date_debut, m.date_fin,
               m.personne_id, m.groupe_id
        FROM mandats_parlementaires m
        WHERE m.chambre LIKE ${chambreFilter}
          AND (m.legislature IS NULL OR m.legislature >= ${seuilLegislature})
      ),
      votes_mandat AS (
        -- Chaque vote est rattaché au mandat qui couvrait le scrutin (mandat d'époque).
        -- AN : fenêtrage par dates EN PLUS de la législature — un député parti en cours
        -- de législature ne se voit pas attribuer les scrutins postérieurs à son départ.
        SELECT
          m.id as mandat_id,
          m.groupe_id,
          v.scrutin_id,
          v.position,
          s.type_vote
        FROM votes v
        JOIN scrutins s ON s.id = v.scrutin_id
        JOIN mandats_cibles m
          ON m.personne_id = v.parlementaire_id
          AND m.chambre = s.chambre
          AND (
                (s.chambre = 'assemblee' AND s.legislature IS NOT NULL
                 AND m.legislature = s.legislature
                 AND s.date >= m.date_debut
                 AND (m.date_fin IS NULL OR s.date <= m.date_fin))
             OR (s.chambre = 'senat' AND m.date_debut <= s.date
                 AND (m.date_fin IS NULL OR m.date_fin >= s.date))
              )
        WHERE v.position != 'absent'
          AND s.chambre LIKE ${chambreFilter}
      ),
      -- Dénominateurs : scrutins de la FENÊTRE du mandat (dates + législature pour l'AN).
      -- LEFT JOIN pour que chaque mandat ciblé apparaisse même sans scrutin couvert
      -- (total=0) : il reçoit alors interventions/amendements sans rester à NULL.
      denom_assemblee AS (
        SELECT m.id as mandat_id,
               COUNT(s.id)::bigint as total,
               COUNT(s.id) FILTER (WHERE s.type_vote = 'solennel')::bigint as total_solennel
        FROM mandats_cibles m
        LEFT JOIN scrutins s ON s.chambre = 'assemblee'
          AND s.legislature IS NOT NULL
          AND s.legislature = m.legislature
          AND s.date >= m.date_debut
          AND (m.date_fin IS NULL OR s.date <= m.date_fin)
        WHERE m.chambre = 'assemblee'
        GROUP BY m.id
      ),
      denom_senat AS (
        SELECT m.id as mandat_id,
               COUNT(s.id)::bigint as total,
               COUNT(s.id) FILTER (WHERE s.type_vote = 'solennel')::bigint as total_solennel
        FROM mandats_cibles m
        LEFT JOIN scrutins s ON s.chambre = 'senat'
          AND s.date >= m.date_debut
          AND (m.date_fin IS NULL OR s.date <= m.date_fin)
        WHERE m.chambre = 'senat'
        GROUP BY m.id
      ),
      denom AS (
        SELECT * FROM denom_assemblee
        UNION ALL
        SELECT * FROM denom_senat
      ),
      num AS (
        SELECT mandat_id,
               COUNT(*) as votes,
               COUNT(*) FILTER (WHERE type_vote = 'solennel') as votes_solennel
        FROM votes_mandat
        GROUP BY mandat_id
      ),
      -- Interventions du mandat : rattachées par personne + chambre + fenêtre de dates
      -- (la table interventions n'a pas de législature ; la fenêtre suffit).
      interventions_mandat AS (
        SELECT m.id as mandat_id,
               COUNT(i.id) as total_interventions,
               COUNT(i.id) FILTER (WHERE i.type = 'question') as total_questions
        FROM mandats_cibles m
        JOIN interventions i
          ON i.parlementaire_id = m.personne_id
          AND i.chambre = m.chambre
          AND i.date >= m.date_debut
          AND (m.date_fin IS NULL OR i.date <= m.date_fin)
        GROUP BY m.id
      ),
      -- Amendements du mandat : AN par législature (plus fiable que la date de dépôt) ;
      -- Sénat par fenêtre de dates sur la date de dépôt.
      amendements_mandat AS (
        SELECT m.id as mandat_id,
               COUNT(a.id) as total_amendements,
               COUNT(a.id) FILTER (WHERE a.sort IN ('Adopté', 'adopte', 'adopte_modifie')) as total_adoptes
        FROM mandats_cibles m
        JOIN amendements a
          ON a.parlementaire_id = m.personne_id
          AND a.chambre = m.chambre
          AND (
                (m.chambre = 'assemblee' AND a.legislature = m.legislature)
             OR (m.chambre = 'senat' AND a.date_depot IS NOT NULL
                 AND a.date_depot >= m.date_debut
                 AND (m.date_fin IS NULL OR a.date_depot <= m.date_fin))
              )
        GROUP BY m.id
      ),
      -- Loyauté : position majoritaire du groupe DU MANDAT, scrutin par scrutin.
      group_majority AS (
        SELECT scrutin_id, groupe_id, position,
               ROW_NUMBER() OVER (PARTITION BY scrutin_id, groupe_id ORDER BY COUNT(*) DESC) as rn
        FROM votes_mandat
        WHERE groupe_id IS NOT NULL
        GROUP BY scrutin_id, groupe_id, position
      ),
      loyaute AS (
        SELECT vm.mandat_id,
               COUNT(*) as total_votes,
               COUNT(*) FILTER (WHERE vm.position = gm.position) as loyal_votes
        FROM votes_mandat vm
        LEFT JOIN group_majority gm
          ON gm.scrutin_id = vm.scrutin_id
          AND gm.groupe_id = vm.groupe_id
          AND gm.rn = 1
        WHERE vm.groupe_id IS NOT NULL
        GROUP BY vm.mandat_id
      )
      UPDATE mandats_parlementaires mp
      SET
        stats_presence = CASE
          WHEN d.total > 0 THEN ROUND((COALESCE(n.votes, 0)::float / d.total) * 100)
          ELSE 0 END,
        stats_presence_solennel = CASE
          WHEN d.total_solennel > 0 THEN ROUND((COALESCE(n.votes_solennel, 0)::float / d.total_solennel) * 100)
          ELSE NULL END,
        stats_participation = COALESCE(n.votes, 0),
        stats_loyaute = CASE
          WHEN l.total_votes > 0 THEN ROUND((l.loyal_votes::float / l.total_votes) * 100)
          ELSE NULL END,
        stats_interventions = COALESCE(im.total_interventions, 0),
        stats_questions = COALESCE(im.total_questions, 0),
        stats_amendements = COALESCE(am.total_amendements, 0),
        stats_amendements_adoptes = COALESCE(am.total_adoptes, 0),
        stats_calculated_at = NOW()
      FROM denom d
      LEFT JOIN num n ON n.mandat_id = d.mandat_id
      LEFT JOIN loyaute l ON l.mandat_id = d.mandat_id
      LEFT JOIN interventions_mandat im ON im.mandat_id = d.mandat_id
      LEFT JOIN amendements_mandat am ON am.mandat_id = d.mandat_id
      WHERE mp.id = d.mandat_id
    `;

    logger.info({ updated: mandatStatsUpdated }, 'Per-mandate stats calculated');

    // -------------------------------------------------------------------------
    // `parlementaires.stats_*` <- stats du MANDAT EN COURS
    // -------------------------------------------------------------------------
    // C'est la colonne sur laquelle trient les listes et les classements. Elle
    // doit donc porter une période COMMUNE à tous les élus comparés : sinon un
    // député de trois mandats est noté sur 7354 scrutins et un primo-élu sur
    // 5354, et le classement mélange deux dénominateurs (mesuré : 15 places
    // d'écart en moyenne, jusqu'à 118). La carrière reste disponible dans les
    // colonnes stats_carriere_*, sur lesquelles le classement peut basculer.
    //
    // Mandat en cours = le plus récent (date_fin NULL en premier).
    const mandatCourantCopie = await prisma.$executeRaw`
      WITH mandat_courant AS (
        SELECT DISTINCT ON (m.personne_id)
               m.personne_id,
               m.stats_presence,
               m.stats_presence_solennel,
               m.stats_loyaute,
               m.stats_participation
        FROM mandats_parlementaires m
        JOIN parlementaires p ON p.id = m.personne_id AND p.chambre = m.chambre
        WHERE m.chambre LIKE ${chambreFilter}
        ORDER BY m.personne_id,
                 (m.date_fin IS NULL) DESC,
                 m.date_debut DESC
      )
      UPDATE parlementaires p
      SET
        stats_presence = COALESCE(mc.stats_presence, p.stats_presence),
        stats_presence_solennel = COALESCE(mc.stats_presence_solennel, p.stats_presence_solennel),
        stats_loyaute = COALESCE(mc.stats_loyaute, p.stats_loyaute),
        stats_participation = COALESCE(mc.stats_participation, p.stats_participation)
      FROM mandat_courant mc
      WHERE p.id = mc.personne_id
    `;

    logger.info({ updated: mandatCourantCopie }, 'Current-mandate stats copied to parlementaires');

    // Compter le total mis à jour
    const countResult = await prisma.parlementaire.count({
      where: {
        actif: true,
        statsCalculatedAt: { not: null },
        ...(chambre && { chambre }),
      },
    });

    const duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;

    logger.info({
      total: countResult,
      updated: countResult,
      errors: 0,
      duration,
    }, 'Stats calculation completed');

    return {
      total: countResult,
      updated: countResult,
      errors: 0,
      duration,
    };
  } catch (error) {
    logger.error({ error: errorMessage(error) }, 'Stats calculation failed');
    throw error;
  }
}

/**
 * Version legacy avec batches (fallback si la version SQL pose problème)
 */
export async function calculateAllStatsLegacy(
  chambre?: 'assemblee' | 'senat'
): Promise<StatsCalculationResult> {
  const startTime = Date.now();
  const BATCH_SIZE = 20;

  logger.info({ chambre: chambre || 'all' }, 'Starting stats calculation (legacy batch mode)...');

  // Récupérer tous les parlementaires actifs
  const parlementaires = await prisma.parlementaire.findMany({
    where: {
      actif: true,
      ...(chambre && { chambre }),
    },
    select: { id: true, slug: true, chambre: true, groupeId: true },
  });

  let updated = 0;
  let errors = 0;

  // Pré-calculer les données globales pour éviter les requêtes répétées
  const globalData = await getGlobalData(chambre);

  // Traiter par VRAIS batches pour éviter l'accumulation mémoire
  const totalBatches = Math.ceil(parlementaires.length / BATCH_SIZE);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batchStart = batchIndex * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, parlementaires.length);
    const batch = parlementaires.slice(batchStart, batchEnd);

    // Log progression tous les 5 batches ou au premier/dernier
    if (batchIndex === 0 || batchIndex === totalBatches - 1 || (batchIndex + 1) % 5 === 0) {
      logger.info({
        batch: batchIndex + 1,
        totalBatches,
        progress: `${Math.round(((batchIndex + 1) / totalBatches) * 100)}%`,
        processed: batchStart,
        total: parlementaires.length,
      }, 'Stats calculation progress');
    }

    const results = await Promise.all(
      batch.map((p) =>
        limit(async () => {
          try {
            await calculateAndStoreStats(p, globalData);
            return true;
          } catch (error) {
            logger.error({ parlementaire: p.slug, error: errorMessage(error) }, 'Error calculating stats');
            return false;
          }
        })
      )
    );

    for (const success of results) {
      if (success) updated++;
      else errors++;
    }

    // Pause entre les batches pour laisser le GC respirer
    // Augmentée à 500ms pour réduire la pression mémoire
    if (batchIndex < totalBatches - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  const duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;

  logger.info({
    total: parlementaires.length,
    updated,
    errors,
    duration,
  }, 'Stats calculation completed');

  return {
    total: parlementaires.length,
    updated,
    errors,
    duration,
  };
}

/**
 * Récupère les données globales nécessaires au calcul des stats
 * (évite de faire ces requêtes pour chaque parlementaire)
 */
async function getGlobalData(chambre?: 'assemblee' | 'senat') {
  // Nombre total de scrutins par chambre (pour calculer la présence)
  const scrutinCounts = await prisma.scrutin.groupBy({
    by: ['chambre'],
    _count: { id: true },
    where: chambre ? { chambre } : undefined,
  });

  const scrutinCountMap = new Map<string, number>();
  for (const sc of scrutinCounts) {
    scrutinCountMap.set(sc.chambre, sc._count.id);
  }

  // Nombre de scrutins solennels par chambre (pour calculer la présence solennelle)
  const scrutinSolennelCounts = await prisma.scrutin.groupBy({
    by: ['chambre'],
    _count: { id: true },
    where: {
      ...(chambre && { chambre }),
      typeVote: 'solennel',
    },
  });

  const scrutinSolennelCountMap = new Map<string, number>();
  for (const sc of scrutinSolennelCounts) {
    scrutinSolennelCountMap.set(sc.chambre, sc._count.id);
  }

  // Date du premier scrutin par chambre
  const oldestScrutins = await prisma.scrutin.groupBy({
    by: ['chambre'],
    _min: { date: true },
    where: chambre ? { chambre } : undefined,
  });

  const oldestScrutinDateMap = new Map<string, Date>();
  for (const os of oldestScrutins) {
    if (os._min.date) {
      oldestScrutinDateMap.set(os.chambre, os._min.date);
    }
  }

  return {
    scrutinCountMap,
    scrutinSolennelCountMap,
    oldestScrutinDateMap,
  };
}

/**
 * Calcule et stocke les stats pour un parlementaire
 */
async function calculateAndStoreStats(
  parlementaire: { id: string; slug: string; chambre: string; groupeId: string | null },
  globalData: Awaited<ReturnType<typeof getGlobalData>>
) {
  const { id, chambre, groupeId } = parlementaire;

  // Utiliser une seule requête SQL optimisée pour récupérer les counts
  const [voteCounts, voteSolennelCounts, interventionCounts, amendementCounts] = await Promise.all([
    // Votes: présence et participation (tous scrutins)
    prisma.vote.groupBy({
      by: ['position'],
      where: { parlementaireId: id },
      _count: { id: true },
    }),

    // Votes sur scrutins solennels uniquement (pour présence solennelle)
    prisma.vote.groupBy({
      by: ['position'],
      where: {
        parlementaireId: id,
        scrutin: { typeVote: 'solennel' },
      },
      _count: { id: true },
    }),

    // Interventions par type
    prisma.intervention.groupBy({
      by: ['type'],
      where: { parlementaireId: id },
      _count: { id: true },
    }),

    // Amendements par statut
    prisma.amendement.groupBy({
      by: ['sort'],
      where: { parlementaireId: id },
      _count: { id: true },
    }),
  ]);

  // Calculer présence (tous scrutins)
  const totalScrutins = globalData.scrutinCountMap.get(chambre) || 1;
  const votesNonAbsent = voteCounts
    .filter((v) => v.position !== 'absent')
    .reduce((sum, v) => sum + v._count.id, 0);
  const statsPresence = Math.round((votesNonAbsent / totalScrutins) * 100);

  // Calculer présence sur scrutins solennels uniquement
  const totalScrutinsSolennels = globalData.scrutinSolennelCountMap.get(chambre) || 0;
  const votesSolennelsNonAbsent = voteSolennelCounts
    .filter((v) => v.position !== 'absent')
    .reduce((sum, v) => sum + v._count.id, 0);
  const statsPresenceSolennel = totalScrutinsSolennels > 0
    ? Math.round((votesSolennelsNonAbsent / totalScrutinsSolennels) * 100)
    : null;

  // Participation (nombre de votes effectifs)
  const statsParticipation = votesNonAbsent;

  // Interventions et questions
  const statsInterventions = interventionCounts.reduce((sum, i) => sum + i._count.id, 0);
  const statsQuestions = interventionCounts
    .filter((i) => i.type === 'question')
    .reduce((sum, i) => sum + i._count.id, 0);

  // Amendements
  const statsAmendements = amendementCounts.reduce((sum, a) => sum + a._count.id, 0);
  const statsAmendementsAdoptes = amendementCounts
    .filter((a) => a.sort === 'Adopté' || a.sort === 'adopte' || a.sort === 'adopte_modifie')
    .reduce((sum, a) => sum + a._count.id, 0);

  // Loyauté (requête plus complexe - seulement si le parlementaire a un groupe)
  let statsLoyaute = 0;
  if (groupeId && votesNonAbsent > 0) {
    statsLoyaute = await calculateLoyaute(id, groupeId, chambre, globalData.oldestScrutinDateMap.get(chambre));
  }

  // Mettre à jour le parlementaire avec les stats pré-calculées
  await prisma.parlementaire.update({
    where: { id },
    data: {
      statsPresence,
      statsPresenceSolennel,
      statsLoyaute,
      statsParticipation,
      statsInterventions,
      statsAmendements,
      statsAmendementsAdoptes,
      statsQuestions,
      statsCalculatedAt: new Date(),
    },
  });
}

/**
 * Calcule le taux de loyauté d'un parlementaire envers son groupe
 * Utilise une requête SQL optimisée pour éviter de charger tous les votes en mémoire
 * Calculé sur TOUS les scrutins disponibles en base
 */
async function calculateLoyaute(
  parlementaireId: string,
  groupeId: string,
  chambre: string,
  since?: Date
): Promise<number> {
  // Utiliser la date du premier scrutin, ou une date très ancienne pour tout inclure
  const sinceDate = since || new Date('2000-01-01');

  // Requête SQL optimisée avec CTEs
  const result = await prisma.$queryRaw<{ loyal_count: bigint; total_count: bigint }[]>`
    WITH parlementaire_votes AS (
      SELECT v.id, v.position, v.scrutin_id
      FROM votes v
      JOIN scrutins s ON v.scrutin_id = s.id
      WHERE v.parlementaire_id = ${parlementaireId}
        AND v.position != 'absent'
        AND s.chambre = ${chambre}
        AND s.date >= ${sinceDate}
    ),
    group_majority AS (
      -- Appartenance au groupe lue sur le mandat couvrant le scrutin : le groupe
      -- est un attribut du mandat, pas de la personne (cf. groupe d'époque).
      SELECT
        v.scrutin_id,
        v.position,
        COUNT(*) as vote_count,
        ROW_NUMBER() OVER (PARTITION BY v.scrutin_id ORDER BY COUNT(*) DESC) as rn
      FROM votes v
      JOIN scrutins s2 ON s2.id = v.scrutin_id
      JOIN mandats_parlementaires m
        ON m.personne_id = v.parlementaire_id
        AND m.chambre = s2.chambre
        AND (
              (s2.chambre = 'assemblee' AND s2.legislature IS NOT NULL
               AND m.legislature = s2.legislature)
           OR (s2.chambre = 'senat' AND m.date_debut <= s2.date
               AND (m.date_fin IS NULL OR m.date_fin >= s2.date))
            )
      WHERE m.groupe_id = ${groupeId}
        AND v.position != 'absent'
      GROUP BY v.scrutin_id, v.position
    )
    SELECT
      COUNT(CASE WHEN pv.position = gm.position THEN 1 END)::bigint as loyal_count,
      COUNT(*)::bigint as total_count
    FROM parlementaire_votes pv
    LEFT JOIN group_majority gm ON pv.scrutin_id = gm.scrutin_id AND gm.rn = 1
  `;

  const { loyal_count, total_count } = result[0] || { loyal_count: 0n, total_count: 0n };

  if (total_count === 0n) return 0;

  return Math.round((Number(loyal_count) / Number(total_count)) * 100);
}

/**
 * Recalcule les stats pour un parlementaire spécifique
 * (utilisé pour invalidation ciblée)
 */
export async function recalculateStatsForParlementaire(parlementaireId: string): Promise<void> {
  const parlementaire = await prisma.parlementaire.findUnique({
    where: { id: parlementaireId },
    select: { id: true, slug: true, chambre: true, groupeId: true },
  });

  if (!parlementaire) {
    throw new Error(`Parlementaire not found: ${parlementaireId}`);
  }

  const globalData = await getGlobalData(parlementaire.chambre as 'assemblee' | 'senat');
  await calculateAndStoreStats(parlementaire, globalData);

  logger.info({ parlementaire: parlementaire.slug }, 'Stats recalculated for parlementaire');
}

/**
 * Invalide le cache des stats (force le recalcul au prochain appel)
 */
export async function invalidateStatsCache(chambre?: 'assemblee' | 'senat'): Promise<number> {
  const result = await prisma.parlementaire.updateMany({
    where: {
      actif: true,
      ...(chambre && { chambre }),
    },
    data: {
      statsCalculatedAt: null,
    },
  });

  logger.info({ count: result.count, chambre: chambre || 'all' }, 'Stats cache invalidated');
  return result.count;
}

// =============================================================================
// GROUPE STATS CALCULATION
// =============================================================================

export interface GroupeStatsResult {
  total: number;
  updated: number;
  errors: number;
  duration: string;
}

/**
 * Calcule et stocke les stats agrégées pour tous les groupes politiques
 * À appeler APRÈS calculateAllStats() pour bénéficier des stats individuelles
 */
export async function calculateAllGroupeStats(
  chambre?: 'assemblee' | 'senat',
  options: StatsOptions = {}
): Promise<GroupeStatsResult> {
  const startTime = Date.now();
  const includeFrozen = options.includeFrozen ?? false;

  logger.info({ chambre: chambre || 'all', includeFrozen }, 'Starting groupe stats calculation...');

  // Récupérer tous les groupes actifs
  const tousGroupes = await prisma.groupePolitique.findMany({
    where: {
      actif: true,
      ...(chambre && { chambre }),
    },
    select: { id: true, slug: true, chambre: true, legislature: true },
  });

  // Les groupes AN des législatures révolues sont figés : leurs stats ne changent
  // plus une fois ingérés. Le batch de nuit les saute (perf) sauf `includeFrozen`.
  const groupes = includeFrozen ? tousGroupes : tousGroupes.filter((g) => !estGroupeFige(g));
  const skipped = tousGroupes.length - groupes.length;
  if (skipped > 0) {
    logger.info({ skipped }, 'Groupes figés sautés (législatures AN révolues)');
  }

  let updated = 0;
  let errors = 0;

  // Traiter séquentiellement avec logging (peu de groupes, pas besoin de parallélisme excessif)
  for (let i = 0; i < groupes.length; i++) {
    const g = groupes[i]!;
    try {
      logger.debug({ groupe: g.slug, progress: `${i + 1}/${groupes.length}` }, 'Calculating groupe stats');
      await calculateAndStoreGroupeStats(g);
      updated++;
    } catch (error) {
      logger.error({ groupe: g.slug, error: errorMessage(error) }, 'Error calculating groupe stats');
      errors++;
    }
  }

  const duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;

  logger.info({
    total: groupes.length,
    updated,
    errors,
    duration,
  }, 'Groupe stats calculation completed');

  return {
    total: groupes.length,
    updated,
    errors,
    duration,
  };
}

/**
 * Calcule et stocke les stats pour un groupe politique
 * Utilise les stats pré-calculées des parlementaires pour éviter les requêtes lourdes
 */
/** Début (1er oct.) de la session sénatoriale courante, par calcul de calendrier. */
function debutSessionSenatCourante(now: Date = new Date()): Date {
  const y = now.getUTCFullYear();
  const anneeDebut = now.getUTCMonth() >= 9 ? y : y - 1; // mois >= 9 = octobre et après
  return new Date(Date.UTC(anneeDebut, 9, 1));
}

async function calculateAndStoreGroupeStats(
  groupe: { id: string; slug: string; chambre: string }
) {
  const { id, chambre } = groupe;

  // Sénat : une SEULE ligne par sigle (périodisation dans les intervalles de mandat).
  // Les stats pré-calculées alimentent la vue COURANTE des pages groupe → on borne à
  // la session courante (mandats en cours + scrutins depuis le 1er oct.). Sans ça, dès
  // l'ingestion de l'historique, `ump` mélangerait les sénateurs 2017-2023 partis avec
  // les actuels. L'AN, périodisée par ligne, n'a pas besoin de cette borne.
  const sessionSenatDebut = chambre === 'senat' ? debutSessionSenatCourante() : undefined;

  // Agrégation sur les MANDATS rattachés au groupe, et non sur les membres
  // actuels : un groupe est propre à une législature (RE, LAREM et GDR-NUPES
  // coexistent en base). Agréger `parlementaires.groupe_id` donnait 0 membre et
  // 0 stat à tout groupe dissous, puisque plus personne n'y siège aujourd'hui.
  // Chaque ligne de groupe reçoit ainsi les stats des mandats de SA période.
  const memberStats = await prisma.mandatParlementaire.aggregate({
    where: {
      groupeId: id,
      statsCalculatedAt: { not: null },
      // Sénat courant = mandats en cours (les anciens sont hors composition actuelle).
      ...(chambre === 'senat' && { dateFin: null }),
    },
    _count: { id: true },
    _avg: {
      statsPresence: true,
      statsPresenceSolennel: true,
      statsLoyaute: true,
    },
    _sum: {
      statsParticipation: true,
    },
  });

  const statsMembresActifs = memberStats._count.id;
  const statsPresenceMoyenne = Math.round(memberStats._avg.statsPresence || 0);
  const statsPresenceSolennelMoyenne = memberStats._avg.statsPresenceSolennel != null
    ? Math.round(memberStats._avg.statsPresenceSolennel)
    : null;
  const statsLoyauteMoyenne = Math.round(memberStats._avg.statsLoyaute || 0);
  const statsParticipation = memberStats._sum.statsParticipation || 0;

  // Cohésion + agrégation des votes, bornées à la session courante pour le Sénat.
  const statsCohesion = await calculateGroupeCohesion(id, chambre, sessionSenatDebut);
  const votesAggregation = await calculateGroupeVotesAggregation(id, sessionSenatDebut);

  // Mettre à jour le groupe avec les stats pré-calculées
  await prisma.groupePolitique.update({
    where: { id },
    data: {
      statsMembresActifs,
      statsPresenceMoyenne,
      statsPresenceSolennelMoyenne,
      statsLoyauteMoyenne,
      statsCohesion,
      statsParticipation,
      statsVotesPour: votesAggregation.pour,
      statsVotesContre: votesAggregation.contre,
      statsVotesAbstention: votesAggregation.abstention,
      statsVotesAbsent: votesAggregation.absent,
      statsCalculatedAt: new Date(),
    },
  });
}

/**
 * Calcule la cohésion moyenne d'un groupe sur les scrutins de SA période
 * Cohésion = % du groupe votant avec la position majoritaire
 *
 * L'appartenance au groupe est lue sur le mandat qui couvrait le scrutin. Cela
 * borne automatiquement le calcul à la législature du groupe (un mandat portant
 * ce groupe n'existe que là), et rend la cohésion des groupes dissous calculable
 * — passer par `parlementaires.groupe_id` la laissait à 0.
 */
async function calculateGroupeCohesion(
  groupeId: string,
  chambre: string,
  sessionSenatDebut?: Date
): Promise<number> {
  // Sénat : borne à la session courante (les stats pré-calculées = vue courante).
  const borneSession = sessionSenatDebut ?? new Date(0);
  const result = await prisma.$queryRaw<{ avg_cohesion: number | null }[]>`
    WITH groupe_votes AS (
      SELECT
        v.scrutin_id,
        v.position,
        COUNT(*) as vote_count
      FROM votes v
      JOIN scrutins s ON v.scrutin_id = s.id
      JOIN mandats_parlementaires m
        ON m.personne_id = v.parlementaire_id
        AND m.chambre = s.chambre
        AND (
              (s.chambre = 'assemblee' AND s.legislature IS NOT NULL
               AND m.legislature = s.legislature
               AND s.date >= m.date_debut
               AND (m.date_fin IS NULL OR s.date <= m.date_fin))
           OR (s.chambre = 'senat' AND m.date_debut <= s.date
               AND (m.date_fin IS NULL OR m.date_fin >= s.date))
            )
      WHERE m.groupe_id = ${groupeId}
        AND s.chambre = ${chambre}
        AND (s.chambre = 'assemblee' OR s.date >= ${borneSession})
        AND v.position != 'absent'
      GROUP BY v.scrutin_id, v.position
    ),
    scrutin_cohesion AS (
      SELECT
        scrutin_id,
        MAX(vote_count) as majority_votes,
        SUM(vote_count) as total_votes
      FROM groupe_votes
      GROUP BY scrutin_id
    )
    SELECT
      COALESCE(AVG(CAST(majority_votes AS FLOAT) / NULLIF(total_votes, 0) * 100), 0) as avg_cohesion
    FROM scrutin_cohesion
  `;

  return Math.round(result[0]?.avg_cohesion || 0);
}

/**
 * Calcule l'agrégation des votes pour un groupe (pour le camembert)
 */
async function calculateGroupeVotesAggregation(
  groupeId: string,
  sessionSenatDebut?: Date
): Promise<{
  pour: number;
  contre: number;
  abstention: number;
  absent: number;
}> {
  // Appartenance lue sur le mandat couvrant le scrutin (cf. calculateGroupeCohesion) :
  // les votes comptés sont ceux émis SOUS ce groupe, pas ceux de ses membres actuels.
  // Sénat : borné à la session courante (vue courante des pages groupe).
  const borneSession = sessionSenatDebut ?? new Date(0);
  const result = await prisma.$queryRaw<{ position: string; count: bigint }[]>`
    SELECT v.position, COUNT(*) as count
    FROM votes v
    JOIN scrutins s ON s.id = v.scrutin_id
    JOIN mandats_parlementaires m
      ON m.personne_id = v.parlementaire_id
      AND m.chambre = s.chambre
      AND (
            (s.chambre = 'assemblee' AND s.legislature IS NOT NULL
             AND m.legislature = s.legislature
             AND s.date >= m.date_debut
             AND (m.date_fin IS NULL OR s.date <= m.date_fin))
         OR (s.chambre = 'senat' AND m.date_debut <= s.date
             AND (m.date_fin IS NULL OR m.date_fin >= s.date))
          )
    WHERE m.groupe_id = ${groupeId}
      AND (s.chambre = 'assemblee' OR s.date >= ${borneSession})
    GROUP BY v.position
  `;

  const aggregation = { pour: 0, contre: 0, abstention: 0, absent: 0 };
  for (const r of result) {
    if (r.position in aggregation) {
      aggregation[r.position as keyof typeof aggregation] = Number(r.count);
    }
  }
  return aggregation;
}

// =============================================================================
// ALLIANCES CALCULATION
// =============================================================================

/**
 * Calcule et stocke les alliances entre TOUS les groupes d'une chambre
 * Exécuté après calculateAllGroupeStats()
 */
export async function calculateAllGroupeAlliances(
  chambre?: 'assemblee' | 'senat',
  options: StatsOptions = {}
): Promise<{ total: number; duration: string }> {
  const startTime = Date.now();
  const includeFrozen = options.includeFrozen ?? false;

  logger.info({ chambre: chambre || 'all', includeFrozen }, 'Starting groupe alliances calculation...');

  // Récupérer tous les groupes actifs
  const tousGroupes = await prisma.groupePolitique.findMany({
    where: {
      actif: true,
      ...(chambre && { chambre }),
    },
    select: { id: true, slug: true, chambre: true, legislature: true },
  });

  // Les alliances d'une législature AN révolue sont figées : on saute ces groupes
  // par défaut (perf). Les écarter avant l'appariement évite aussi de recalculer
  // leurs paires internes. La purge inter-périodes ci-dessous reste inconditionnelle.
  const groupes = includeFrozen ? tousGroupes : tousGroupes.filter((g) => !estGroupeFige(g));
  const skipped = tousGroupes.length - groupes.length;
  if (skipped > 0) {
    logger.info({ skipped }, 'Groupes figés sautés pour les alliances (législatures AN révolues)');
  }

  // Les alliances s'apparient PAR PÉRIODE, et non par chambre : deux groupes de
  // législatures différentes n'ont jamais voté ensemble. Sans cette clé, on
  // appariait LAREM (15e) avec le RN de la 17e — un taux d'accord calculé sur un
  // ensemble de scrutins communs vide, donc dénué de sens.
  const chambreGroups = new Map<string, typeof groupes>();
  for (const g of groupes) {
    const cle = `${g.chambre}:${g.legislature ?? 'na'}`;
    if (!chambreGroups.has(cle)) {
      chambreGroups.set(cle, []);
    }
    chambreGroups.get(cle)!.push(g);
  }

  let totalPairs = 0;

  for (const [periodeKey, groupesInChambre] of chambreGroups) {
    // Calculer toutes les paires possibles
    const totalPairsInChambre = (groupesInChambre.length * (groupesInChambre.length - 1)) / 2;
    let processedInChambre = 0;

    logger.info({ periode: periodeKey, pairs: totalPairsInChambre }, 'Starting alliances calculation for periode');

    for (let i = 0; i < groupesInChambre.length; i++) {
      for (let j = i + 1; j < groupesInChambre.length; j++) {
        const g1 = groupesInChambre[i]!;
        const g2 = groupesInChambre[j]!;

        try {
          // Sénat : borne à la session courante (alliances = vue courante), comme les
          // autres stats de groupe. L'AN est déjà borné par la clé de période.
          const borneSenat = g1.chambre === 'senat' ? debutSessionSenatCourante() : undefined;
          await calculateAndStoreAlliance(g1.id, g2.id, g1.chambre, borneSenat);
          totalPairs++;
          processedInChambre++;

          // Log progression tous les 10 paires
          if (processedInChambre % 10 === 0) {
            logger.debug({
              periode: periodeKey,
              progress: `${processedInChambre}/${totalPairsInChambre}`,
            }, 'Alliances progress');
          }
        } catch (error) {
          logger.error({ g1: g1.slug, g2: g2.slug, error: errorMessage(error) }, 'Error calculating alliance');
        }
      }
    }
  }

  // Purge des paires inter-périodes. L'upsert écrit les paires valides mais ne
  // supprime jamais les anciennes : les alliances calculées avant la périodisation
  // (LAREM 15e « alliée à 100 % » de EPR 17e, alors qu'ils n'ont jamais siégé
  // ensemble) survivraient indéfiniment en base.
  const purgees = await prisma.$executeRaw`
    DELETE FROM groupes_alliances a
    USING groupes_politiques g1, groupes_politiques g2
    WHERE g1.id = a.groupe_from_id
      AND g2.id = a.groupe_to_id
      AND (g1.chambre IS DISTINCT FROM g2.chambre
           OR g1.legislature IS DISTINCT FROM g2.legislature)
  `;
  if (purgees > 0) {
    logger.info({ purgees }, 'Alliances inter-périodes supprimées (obsolètes)');
  }

  const duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
  logger.info({ totalPairs, duration }, 'Groupe alliances calculation completed');

  return { total: totalPairs, duration };
}

/**
 * Calcule l'alliance entre deux groupes
 */
async function calculateAndStoreAlliance(
  groupeId1: string,
  groupeId2: string,
  chambre: string,
  sessionSenatDebut?: Date
): Promise<void> {
  // Requête SQL optimisée pour calculer le taux d'accord entre deux groupes
  // Compare la position majoritaire de chaque groupe sur chaque scrutin
  // Appartenance lue sur le mandat couvrant le scrutin (groupe d'époque) : cela
  // borne chaque groupe aux scrutins de SA période. Passer par
  // `parlementaires.groupe_id` attribuait à un groupe les votes que ses membres
  // actuels ont émis sous d'autres législatures, dans d'autres groupes.
  // Sénat : borne supplémentaire à la session courante (vue courante des alliances).
  const borneSession = sessionSenatDebut ?? new Date(0);
  const result = await prisma.$queryRaw<{ votes_communs: bigint; votes_totaux: bigint }[]>`
    WITH groupe1_positions AS (
      SELECT
        v.scrutin_id,
        v.position,
        COUNT(*) as vote_count,
        ROW_NUMBER() OVER (PARTITION BY v.scrutin_id ORDER BY COUNT(*) DESC) as rn
      FROM votes v
      JOIN scrutins s ON v.scrutin_id = s.id
      JOIN mandats_parlementaires m
        ON m.personne_id = v.parlementaire_id
        AND m.chambre = s.chambre
        AND (
              (s.chambre = 'assemblee' AND s.legislature IS NOT NULL
               AND m.legislature = s.legislature
               AND s.date >= m.date_debut
               AND (m.date_fin IS NULL OR s.date <= m.date_fin))
           OR (s.chambre = 'senat' AND m.date_debut <= s.date
               AND (m.date_fin IS NULL OR m.date_fin >= s.date))
            )
      WHERE m.groupe_id = ${groupeId1}
        AND s.chambre = ${chambre}
        AND (s.chambre = 'assemblee' OR s.date >= ${borneSession})
        AND v.position != 'absent'
      GROUP BY v.scrutin_id, v.position
    ),
    groupe2_positions AS (
      SELECT
        v.scrutin_id,
        v.position,
        COUNT(*) as vote_count,
        ROW_NUMBER() OVER (PARTITION BY v.scrutin_id ORDER BY COUNT(*) DESC) as rn
      FROM votes v
      JOIN scrutins s ON v.scrutin_id = s.id
      JOIN mandats_parlementaires m
        ON m.personne_id = v.parlementaire_id
        AND m.chambre = s.chambre
        AND (
              (s.chambre = 'assemblee' AND s.legislature IS NOT NULL
               AND m.legislature = s.legislature
               AND s.date >= m.date_debut
               AND (m.date_fin IS NULL OR s.date <= m.date_fin))
           OR (s.chambre = 'senat' AND m.date_debut <= s.date
               AND (m.date_fin IS NULL OR m.date_fin >= s.date))
            )
      WHERE m.groupe_id = ${groupeId2}
        AND s.chambre = ${chambre}
        AND (s.chambre = 'assemblee' OR s.date >= ${borneSession})
        AND v.position != 'absent'
      GROUP BY v.scrutin_id, v.position
    ),
    comparaison AS (
      SELECT
        g1.scrutin_id,
        CASE WHEN g1.position = g2.position THEN 1 ELSE 0 END as accord
      FROM groupe1_positions g1
      JOIN groupe2_positions g2 ON g1.scrutin_id = g2.scrutin_id
      WHERE g1.rn = 1 AND g2.rn = 1
    )
    SELECT
      SUM(accord)::bigint as votes_communs,
      COUNT(*)::bigint as votes_totaux
    FROM comparaison
  `;

  const { votes_communs, votes_totaux } = result[0] || { votes_communs: 0n, votes_totaux: 0n };
  const tauxAccord = votes_totaux > 0n
    ? Math.round((Number(votes_communs) / Number(votes_totaux)) * 100)
    : 0;

  // Upsert les deux directions (g1->g2 et g2->g1) pour faciliter les requêtes
  await prisma.groupeAlliance.upsert({
    where: { groupeFromId_groupeToId: { groupeFromId: groupeId1, groupeToId: groupeId2 } },
    create: {
      groupeFromId: groupeId1,
      groupeToId: groupeId2,
      votesCommuns: Number(votes_communs),
      votesTotaux: Number(votes_totaux),
      tauxAccord,
      calculatedAt: new Date(),
    },
    update: {
      votesCommuns: Number(votes_communs),
      votesTotaux: Number(votes_totaux),
      tauxAccord,
      calculatedAt: new Date(),
    },
  });

  // Direction inverse
  await prisma.groupeAlliance.upsert({
    where: { groupeFromId_groupeToId: { groupeFromId: groupeId2, groupeToId: groupeId1 } },
    create: {
      groupeFromId: groupeId2,
      groupeToId: groupeId1,
      votesCommuns: Number(votes_communs),
      votesTotaux: Number(votes_totaux),
      tauxAccord,
      calculatedAt: new Date(),
    },
    update: {
      votesCommuns: Number(votes_communs),
      votesTotaux: Number(votes_totaux),
      tauxAccord,
      calculatedAt: new Date(),
    },
  });
}

// =============================================================================
// THEMATIC STATS CALCULATION
// =============================================================================

// Thématiques principales basées sur les tags existants des scrutins
const THEMATIQUES = [
  'budget',
  'fiscalité',
  'social',
  'travail',
  'santé',
  'éducation',
  'sécurité',
  'justice',
  'environnement',
  'europe',
  'international',
  'immigration',
  'institutions',
  'agriculture',
  'économie',
  'culture',
];

/**
 * Calcule et stocke les stats thématiques pour TOUS les groupes
 */
export async function calculateAllGroupeThematiques(
  chambre?: 'assemblee' | 'senat',
  options: StatsOptions = {}
): Promise<{ total: number; duration: string }> {
  const startTime = Date.now();
  const includeFrozen = options.includeFrozen ?? false;

  logger.info({ chambre: chambre || 'all', includeFrozen }, 'Starting groupe thematiques calculation...');

  const tousGroupes = await prisma.groupePolitique.findMany({
    where: {
      actif: true,
      ...(chambre && { chambre }),
    },
    select: { id: true, slug: true, chambre: true, legislature: true },
  });

  // Positions thématiques d'une législature AN révolue = figées → sautées par défaut.
  const groupes = includeFrozen ? tousGroupes : tousGroupes.filter((g) => !estGroupeFige(g));
  const skipped = tousGroupes.length - groupes.length;
  if (skipped > 0) {
    logger.info({ skipped }, 'Groupes figés sautés pour les thématiques (législatures AN révolues)');
  }

  let totalStats = 0;
  const totalGroupes = groupes.length;

  for (let i = 0; i < groupes.length; i++) {
    const groupe = groupes[i]!;
    try {
      logger.debug({
        groupe: groupe.slug,
        progress: `${i + 1}/${totalGroupes}`,
        thematiques: THEMATIQUES.length,
      }, 'Calculating thematiques for groupe');

      await calculateAndStoreGroupeThematiques(groupe.id, groupe.chambre);
      totalStats += THEMATIQUES.length;
    } catch (error) {
      logger.error({ groupe: groupe.slug, error: errorMessage(error) }, 'Error calculating thematiques');
    }
  }

  const duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
  logger.info({ totalStats, duration }, 'Groupe thematiques calculation completed');

  return { total: totalStats, duration };
}

/**
 * Calcule les stats thématiques pour un groupe
 */
async function calculateAndStoreGroupeThematiques(groupeId: string, chambre: string): Promise<void> {
  for (const thematique of THEMATIQUES) {
    // Requête SQL pour calculer les stats de vote sur cette thématique
    const result = await prisma.$queryRaw<{
      votes_totaux: bigint;
      votes_pour: bigint;
      votes_contre: bigint;
      votes_abstention: bigint;
      avg_cohesion: number | null;
    }[]>`
      WITH scrutins_theme AS (
        SELECT id
        FROM scrutins
        WHERE chambre = ${chambre}
          AND (
            ${thematique} = ANY(tags)
            OR LOWER(titre) LIKE ${`%${thematique}%`}
          )
      ),
      groupe_votes AS (
        -- Appartenance lue sur le mandat couvrant le scrutin (groupe d'époque) :
        -- borne la thématique aux scrutins de la période du groupe.
        SELECT
          v.scrutin_id,
          v.position,
          COUNT(*) as vote_count,
          ROW_NUMBER() OVER (PARTITION BY v.scrutin_id ORDER BY COUNT(*) DESC) as rn
        FROM votes v
        JOIN scrutins s ON s.id = v.scrutin_id
        JOIN mandats_parlementaires m
          ON m.personne_id = v.parlementaire_id
          AND m.chambre = s.chambre
          AND (
                (s.chambre = 'assemblee' AND s.legislature IS NOT NULL
                 AND m.legislature = s.legislature
                 AND s.date >= m.date_debut
                 AND (m.date_fin IS NULL OR s.date <= m.date_fin))
             OR (s.chambre = 'senat' AND m.date_debut <= s.date
                 AND (m.date_fin IS NULL OR m.date_fin >= s.date))
              )
        WHERE m.groupe_id = ${groupeId}
          AND v.scrutin_id IN (SELECT id FROM scrutins_theme)
          AND v.position != 'absent'
        GROUP BY v.scrutin_id, v.position
      ),
      positions_majoritaires AS (
        SELECT scrutin_id, position, vote_count,
               (SELECT SUM(vote_count) FROM groupe_votes gv2 WHERE gv2.scrutin_id = gv.scrutin_id) as total_votes
        FROM groupe_votes gv
        WHERE rn = 1
      )
      SELECT
        COUNT(*)::bigint as votes_totaux,
        SUM(CASE WHEN position = 'pour' THEN 1 ELSE 0 END)::bigint as votes_pour,
        SUM(CASE WHEN position = 'contre' THEN 1 ELSE 0 END)::bigint as votes_contre,
        SUM(CASE WHEN position = 'abstention' THEN 1 ELSE 0 END)::bigint as votes_abstention,
        AVG(CAST(vote_count AS FLOAT) / NULLIF(total_votes, 0) * 100) as avg_cohesion
      FROM positions_majoritaires
    `;

    const stats = result[0] || {
      votes_totaux: 0n,
      votes_pour: 0n,
      votes_contre: 0n,
      votes_abstention: 0n,
      avg_cohesion: null,
    };

    const votesTotaux = Number(stats.votes_totaux);
    const votesPour = Number(stats.votes_pour);
    const votesContre = Number(stats.votes_contre);
    const votesAbstention = Number(stats.votes_abstention);

    // Position moyenne: +100 = toujours Pour, -100 = toujours Contre, 0 = neutre/abstention
    const positionMoyenne = votesTotaux > 0
      ? ((votesPour - votesContre) / votesTotaux) * 100
      : 0;

    const cohesionMoyenne = Math.round(stats.avg_cohesion || 0);

    // Upsert
    await prisma.groupeThematique.upsert({
      where: { groupeId_thematique: { groupeId, thematique } },
      create: {
        groupeId,
        thematique,
        votesTotaux,
        votesPour,
        votesContre,
        votesAbstention,
        positionMoyenne,
        cohesionMoyenne,
        calculatedAt: new Date(),
      },
      update: {
        votesTotaux,
        votesPour,
        votesContre,
        votesAbstention,
        positionMoyenne,
        cohesionMoyenne,
        calculatedAt: new Date(),
      },
    });
  }
}
