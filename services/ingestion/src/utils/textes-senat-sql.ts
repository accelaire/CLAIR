// =============================================================================
// À quel dossier appartient un amendement du Sénat ?
// =============================================================================
//
// À CELUI DE SON TEXTE, ET LA SOURCE LE DIT. La base AMELI du Sénat publie,
// pour chaque texte amendé, le signet de son dossier DOSLEG (`txt_ameli`,
// colonne `doslegsignet` : `pjlf2027`, `ppl24-661`), recopié dans
// `textes_senat`. Le dossier est `SENAT-<signet>`.
//
// Jusqu'au 21 novembre 2026, rien ne lisait ce signet : le dossier d'un
// amendement du Sénat venait du scrutin auquel on l'avait relié, puis de ses
// voisins de texte. Or un numéro de texte du Sénat n'est unique que dans sa
// session de dépôt (le n° 155 est le PLF 2014 en 2013-2014 et le PLF 2027 en
// 2026-2027), et le lien scrutin → amendement ignorait la session : les 4 696
// amendements du PLF 2027 se sont retrouvés sous « Budget 2014 ». Au total,
// 23 998 des 45 359 amendements rattachés l'étaient au mauvais dossier.
//
// Les parties d'un PLF n'ont pas toujours de signet (PLF 2025) : elles prennent
// celui des autres textes de même session de dépôt et de même numéro, s'il est
// unique.
//
// Ce module ne contient que du SQL en chaînes, sans aucun import, pour les
// contrôles de check-quality. Les workers passent par textes-senat-db.ts.
// =============================================================================

/**
 * Définit deux CTE :
 *  - `signet_du_texte_senat` (texte_ref, signet) : le signet de chaque texte
 *    AMELI, ou celui, unique, de ses homonymes de même session de dépôt ;
 *  - `dossier_du_texte_senat` (texte_ref, signet, dossier_id) : les textes dont
 *    la source connaît le dossier. `dossier_id` est NULL tant que le dossier
 *    n'est pas en base (il arrive par `sync-dossiers-senat`) : l'amendement
 *    attend alors sans dossier, plutôt que d'en recevoir un autre.
 */
export const CTE_DOSSIER_DU_TEXTE_SENAT_SQL = `
  signet_du_texte_senat AS MATERIALIZED (
    SELECT t.texte_ref, COALESCE(t.signet, f.signet) AS signet
    FROM textes_senat t
    LEFT JOIN (
      SELECT session_depot, numero, min(signet) AS signet
      FROM textes_senat
      WHERE signet IS NOT NULL
      GROUP BY session_depot, numero
      HAVING count(DISTINCT signet) = 1
    ) f ON t.signet IS NULL AND f.session_depot = t.session_depot AND f.numero = t.numero
  ),
  dossier_du_texte_senat AS MATERIALIZED (
    SELECT s.texte_ref, s.signet, d.id AS dossier_id
    FROM signet_du_texte_senat s
    LEFT JOIN dossiers_legislatifs d ON d.uid = 'SENAT-' || s.signet
    WHERE s.signet IS NOT NULL
  )
`;

/**
 * Le texte de l'amendement `alias` est-il couvert par la source ? Si oui, son
 * dossier est celui de `dossier_du_texte_senat` et aucune propagation (scrutin,
 * voisin) ne doit y toucher. Suppose le CTE ci-dessus.
 */
export function texteSenatCouvertSql(alias: string): string {
  return `EXISTS (SELECT 1 FROM dossier_du_texte_senat dts WHERE dts.texte_ref = ${alias}.texte_ref)`;
}

/**
 * Année d'ouverture de la session que désigne un signet de dossier du Sénat,
 * ou NULL s'il ne suit aucun format connu.
 *
 *  - `ppl24-661` : session 2024-2025 (`99` = 1999, `05` = 2005) ;
 *  - `pjlf2027`, `plfss2027` : le budget de 2027 se dépose à l'automne 2026,
 *    session 2026-2027. Vérifié sur AMELI : 2 973 textes sur 2 973.
 *
 * `expr` est une expression SQL écrite par le code, jamais une donnée.
 */
export function sessionDuSignetSql(expr: string): string {
  return `(CASE
    WHEN ${expr} ~ '^[a-z]+[0-9]{2}-[0-9]+'
      THEN CASE WHEN substring(${expr} from '^[a-z]+([0-9]{2})-')::int >= 50 THEN 1900 ELSE 2000 END
           + substring(${expr} from '^[a-z]+([0-9]{2})-')::int
    WHEN ${expr} ~ '^(pjlf|plfss)[0-9]{4}$'
      THEN substring(${expr} from '([0-9]{4})$')::int - 1
  END)`;
}

/**
 * Année d'ouverture de la session parlementaire d'une date : la session
 * ordinaire s'ouvre en octobre, les sessions extraordinaires de juillet à
 * septembre appartiennent encore à la précédente.
 */
export function sessionDeLaDateSql(expr: string): string {
  return `(extract(year from ${expr})::int - CASE WHEN extract(month from ${expr}) >= 10 THEN 0 ELSE 1 END)`;
}

/**
 * Le dossier `d` peut-il recevoir l'amendement `a` ? Garde des propagations
 * (scrutin → amendement, voisins de texte) pour les amendements que la source
 * ne couvre pas : un amendement n'est jamais déposé avant la session de son
 * dossier. Vérifié sur tout AMELI (280 000 amendements, aucun). Vrai hors
 * Sénat et quand la date ou la session est inconnue. La borne haute n'existe
 * pas : une navette amende un texte jusqu'à onze sessions après son dépôt.
 */
export function dossierSenatPossiblePourSql(d: string, a: string): string {
  const session = sessionDuSignetSql(`substring(${d}.uid from 7)`);
  return `(${d}.uid NOT LIKE 'SENAT-%' OR ${a}.date_depot IS NULL OR ${session} IS NULL
    OR ${sessionDeLaDateSql(`${a}.date_depot`)} >= ${session})`;
}

// -----------------------------------------------------------------------------
// Mesures : la commande `rattacher-amendements-senat` les affiche avant et
// après, check-quality en fait des invariants. Chacune rend `value`.
// -----------------------------------------------------------------------------

/** Amendements du Sénat dont le dossier n'est pas celui que la source donne à leur texte. */
export const AMENDEMENTS_SENAT_HORS_DOSSIER_DU_TEXTE_SQL = `
  WITH ${CTE_DOSSIER_DU_TEXTE_SENAT_SQL}
  SELECT count(*)::int AS value
  FROM amendements a
  JOIN dossier_du_texte_senat x ON x.texte_ref = a.texte_ref
  WHERE a.chambre = 'senat'
    AND a.dossier_id IS DISTINCT FROM x.dossier_id`;

/** Amendements du Sénat rattachés à un dossier d'une session postérieure à leur dépôt. */
export const AMENDEMENTS_SENAT_AVANT_SESSION_DU_DOSSIER_SQL = `
  SELECT count(*)::int AS value
  FROM amendements a
  JOIN dossiers_legislatifs d ON d.id = a.dossier_id
  WHERE a.chambre = 'senat'
    AND NOT ${dossierSenatPossiblePourSql('d', 'a')}`;

/** Liens scrutin du Sénat → amendement déposé après le jour du vote. */
export const LIENS_SENAT_APRES_LE_VOTE_SQL = `
  SELECT count(*)::int AS value
  FROM "_AmendementToScrutin" ats
  JOIN scrutins s ON s.id = ats."B"
  JOIN amendements a ON a.id = ats."A"
  WHERE s.chambre = 'senat'
    AND a.date_depot IS NOT NULL
    AND a.date_depot::date > s.date::date`;

/**
 * Liens scrutin du Sénat → amendement dont le dossier source n'est ni celui du
 * scrutin ni celui que nomme la source du scrutin (`dossierRef`). Même
 * condition que effacerLiensSenatHorsDossierDuTexte.
 */
export const LIENS_SENAT_HORS_DOSSIER_DU_TEXTE_SQL = `
  WITH ${CTE_DOSSIER_DU_TEXTE_SENAT_SQL}
  SELECT count(*)::int AS value
  FROM "_AmendementToScrutin" ats
  JOIN scrutins s ON s.id = ats."B"
  JOIN amendements a ON a.id = ats."A"
  JOIN dossier_du_texte_senat x ON x.texte_ref = a.texte_ref
  WHERE s.chambre = 'senat'
    AND s.dossier_id IS NOT NULL
    AND x.dossier_id IS NOT NULL
    AND x.dossier_id <> s.dossier_id
    AND x.signet IS DISTINCT FROM lower(s.source_data->>'dossierRef')`;
