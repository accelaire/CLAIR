// =============================================================================
// Amendements d'un parlementaire : déposés, cosignés, ou les deux
// =============================================================================

/**
 * Rôle du parlementaire sur l'amendement, paramètre `role` des routes
 * `/:slug/amendements` et `/:slug/amendements/dossiers`.
 *
 * - `depose` : il en est l'auteur (`amendements.parlementaire_id`) ;
 * - `cosigne` : il l'a cosigné sans en être l'auteur ;
 * - `tous` : l'un ou l'autre, le périmètre historique de ces routes.
 *
 * Les deux ensembles sont presque disjoints (onze amendements en tout listent
 * leur auteur parmi les cosignataires), mais pas tout à fait : `cosigne` les
 * retire pour que `depose` + `cosigne` = `tous`.
 */
export const ROLES_AMENDEMENT = ['depose', 'cosigne', 'tous'] as const;
export type RoleAmendement = (typeof ROLES_AMENDEMENT)[number];

/**
 * Le périmètre d'un rôle, pour une requête sur `amendements a` dont le
 * premier paramètre (`$1`) est l'id du parlementaire : un préfixe `WITH`, une
 * jointure à placer après `FROM amendements a`, une condition à ajouter au
 * WHERE.
 *
 * `depose` filtre directement sur l'index `parlementaire_id` : quelques
 * milliers de lignes au plus. Les cosignatures passent par la table de
 * jonction : un député LFI en cosigne plus de 50 000, d'où leur coût.
 *
 * `tous` reste une UNION et non un `OR` dans un seul WHERE : en `OR`,
 * Postgres ne peut se servir d'aucun des deux index et parcourt toute la
 * table en séquentiel.
 */
export function perimetreAmendements(role: RoleAmendement): {
  cte: string;
  jointure: string;
  condition: string | null;
} {
  switch (role) {
    case 'depose':
      return { cte: '', jointure: '', condition: 'a.parlementaire_id = $1' };
    case 'cosigne':
      return {
        cte: `WITH candidats AS (
        SELECT "A" AS id FROM "_AmendementCosignataires" WHERE "B" = $1
        EXCEPT
        SELECT id FROM amendements WHERE parlementaire_id = $1
      )`,
        jointure: 'JOIN candidats c ON c.id = a.id',
        condition: null,
      };
    case 'tous':
      return {
        cte: `WITH candidats AS (
        SELECT id FROM amendements WHERE parlementaire_id = $1
        UNION
        SELECT "A" AS id FROM "_AmendementCosignataires" WHERE "B" = $1
      )`,
        jointure: 'JOIN candidats c ON c.id = a.id',
        condition: null,
      };
  }
}
