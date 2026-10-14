// =============================================================================
// À quelle législature appartient un dossier de l'Assemblée ?
// =============================================================================
//
// À PLUSIEURS. Un dossier garde l'identifiant de la législature où il s'est
// ouvert (`DLR5L16N49868`) et se poursuit dans les suivantes : texte adopté par
// le Sénat puis transmis, texte repris après une dissolution. L'archive de la
// 17e en contient 196 ouverts avant elle. « Simplification de la vie
// économique », déposé en 2024, a été examiné en 2025 sur les textes n° 481 et
// 1191 de la 17e : ses 4 237 amendements de la 17e appartiennent à
// `DLR5L16N49868`.
//
// La règle « un dossier n'appartient qu'à la législature de son identifiant »,
// posée partout après l'incident « Bioéthique » (des amendements de la 17e
// rattachés à un dossier de la 15e par leur seul numéro), refusait donc le bon
// lien. Faute de lui, des passes approximatives en posaient un mauvais :
// 2 750 amendements de la simplification sous un dossier sur l'énergie, 878 du
// statut de l'élu sous un autre dossier, au 9 octobre 2026.
//
// LA RÈGLE JUSTE. Un dossier vaut pour la législature de son identifiant, et
// pour celle de chaque texte ou vote que ses actes citent (`…ANR5L17B0481`,
// `VTANR5L17V451`). Le garde-fou « Bioéthique » tient toujours : ce dossier de
// la 15e ne cite aucun texte de la 17e.
//
// Ce module ne contient que du SQL en chaînes, sans aucun import : les
// contrôles de check-quality, qui sont des requêtes texte, s'en servent sans
// charger `@prisma/client` (dont l'import lit le `.env`). Les workers passent
// par legislatures-dossier.ts.
// =============================================================================

/**
 * Les couples (dossier, législature) des dossiers de l'Assemblée. À poser en
 * CTE : il définit `legislatures_dossier`.
 */
export const CTE_LEGISLATURES_DOSSIER_SQL = `
  legislatures_dossier AS MATERIALIZED (
    SELECT d.id AS dossier_id, substring(d.uid from 'DLR5L([0-9]+)N')::int AS legislature
    FROM dossiers_legislatifs d
    WHERE d.uid LIKE 'DLR5L%'
    UNION
    SELECT d.id, (m[1])::int
    FROM dossiers_legislatifs d,
         LATERAL regexp_matches(d.source_data::text, 'ANR5L([0-9]+)[BV]', 'g') AS m
    WHERE d.uid LIKE 'DLR5L%' AND d.source_data IS NOT NULL
  )
`;

/**
 * Le dossier `alias` vaut pour la législature `legislature` (expression SQL).
 * Un dossier qui n'est pas de l'Assemblée (Sénat) n'est pas concerné. Suppose
 * le CTE `legislatures_dossier` dans la requête.
 */
export function dossierValantPourSql(alias: string, legislature: string): string {
  return `(
    ${alias}.uid NOT LIKE 'DLR5L%'
    OR EXISTS (
      SELECT 1 FROM legislatures_dossier ld
      WHERE ld.dossier_id = ${alias}.id AND ld.legislature = ${legislature}
    )
  )`;
}

/**
 * Le dossier où la source range chaque texte de l'Assemblée : les textes
 * associés et adoptés des actes de chaque dossier. Un texte que deux dossiers
 * revendiquent n'y figure pas. À poser en CTE : il définit `texte_du_dossier`.
 *
 * C'est la vérité de la source : les amendements d'un texte vont dans ce
 * dossier, quoi qu'en aient dit les passes de propagation.
 */
export const CTE_TEXTE_DU_DOSSIER_SQL = `
  textes_cites AS (
    SELECT DISTINCT d.id AS dossier_id, m[1] AS texte_ref
    FROM dossiers_legislatifs d,
         LATERAL regexp_matches(
           d.source_data::text,
           '"(?:refTexteAssocie|texteAssocie|texteAdopte)": "([A-Z]+ANR5L[0-9]+B(?:TC)?[0-9]+)"',
           'g'
         ) AS m
    WHERE d.uid LIKE 'DLR5L%' AND d.source_data IS NOT NULL
  ),
  texte_du_dossier AS MATERIALIZED (
    SELECT texte_ref, min(dossier_id) AS dossier_id
    FROM textes_cites
    GROUP BY texte_ref
    HAVING count(*) = 1
  )
`;
