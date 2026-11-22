// =============================================================================
// Identifiant stable d'un amendement du Sénat
// =============================================================================
//
// UN AMENDEMENT, UNE LIGNE. senat.fr identifie un amendement par la session de
// DÉPÔT de son texte, le numéro de ce texte et son propre numéro, sans la
// rectification : `/amendements/2026-2027/89/Amdt_1.html` reste l'adresse de
// « 1 rect. quinquies ». L'uid suit la même règle :
//
//   SENAT-AMD-S2026-2027-89-1
//   SENAT-AMD-S2025-2026-689-COM-1      (amendement de commission)
//
// Jusqu'au 22/11/2026, l'uid du CSV recopiait le numéro entier : chaque
// rectification créait une nouvelle ligne et laissait l'ancienne. Les lignes de
// l'ancien import complet d'AMELI (`SENAT-AMD-{id AMELI}`, une par version) et
// celles du CSV sans adresse (`SENAT-AMD-T{texte}-…`) doublonnaient aussi
// celles du CSV : 17 669 lignes en trop sur 77 785 en production, dont 15 849
// comptées sur la fiche d'un sénateur. fusionnerAmendementsSenat
// (workers/amendements-senat-uid.ts) ramène toutes les lignes à cette forme.
//
// Pas de collision entre la commission et la séance d'un même numéro de texte
// (`ppl16-155`) : dans AMELI, tous les amendements de commission (57 005) sont
// numérotés `COM-…`, aucun amendement de séance ne l'est.
//
// Ce module n'importe rien : check-quality en lit le SQL.
// =============================================================================

/**
 * Le numéro d'un amendement sans sa rectification : `12 rect. bis` → `12`.
 * AMELI stocke le numéro de base (la rectification est une colonne à part) ;
 * le CSV de senat.fr donne le numéro complet.
 */
export function normalizeSenatNumero(numero: string): string {
  return numero.replace(/\s+rect\b.*$/i, '').trim();
}

/** `2026` → `2026-2027`, le libellé des adresses senat.fr. */
function libelleSession(sessionDepot: number): string {
  return `${sessionDepot}-${sessionDepot + 1}`;
}

/**
 * L'uid stable d'un amendement du Sénat.
 *
 * @param session libellé de la session de DÉPÔT du texte (`2025-2026`), ou son
 *   année d'ouverture
 * @param texteNum numéro du texte dans cette session
 * @param numero numéro de l'amendement, rectification comprise ou non
 */
export function uidAmendementSenat(session: string | number, texteNum: string, numero: string): string {
  const libelle = typeof session === 'number' ? libelleSession(session) : session;
  return `SENAT-AMD-S${libelle}-${texteNum}-${normalizeSenatNumero(numero).replace(/\s+/g, '_')}`;
}

/**
 * Le même uid en SQL, pour une ligne `a` d'`amendements` jointe à son texte `t`
 * de `textes_senat` (`t.texte_ref = a.texte_ref`). Doit rester identique à
 * uidAmendementSenat : un écart ferait échouer l'invariant
 * AMENDEMENTS_SENAT_UID_INSTABLE_SQL dès la nuit suivante, la synchro CSV
 * écrivant l'uid calculé en JavaScript.
 *
 * `\M` (fin de mot) joue le rôle du `\b` de JavaScript après `rect`.
 */
export function uidAmendementSenatSql(a: string, t: string): string {
  return `('SENAT-AMD-S' || ${t}.session_depot || '-' || (${t}.session_depot + 1) || '-' || ${t}.numero || '-' || `
    + `regexp_replace(btrim(regexp_replace(${a}.numero, '\\s+rect\\M.*$', '', 'i')), '\\s+', '_', 'g'))`;
}

/**
 * Amendements du Sénat en trop : pour chaque uid stable porté par plusieurs
 * lignes, toutes sauf une. Invariant de check-quality (attendu : 0).
 */
export const AMENDEMENTS_SENAT_EN_DOUBLE_SQL = `
  SELECT COALESCE(sum(n - 1), 0)::int AS value FROM (
    SELECT count(*) AS n
    FROM amendements a
    JOIN textes_senat t ON t.texte_ref = a.texte_ref
    WHERE a.chambre = 'senat'
    GROUP BY ${uidAmendementSenatSql('a', 't')}
    HAVING count(*) > 1
  ) g`;

/**
 * Amendements du Sénat dont l'uid n'est pas la forme stable : une synchro qui
 * recommencerait à mettre la rectification dans l'uid. Attendu : 0.
 */
export const AMENDEMENTS_SENAT_UID_INSTABLE_SQL = `
  SELECT count(*)::int AS value
  FROM amendements a
  JOIN textes_senat t ON t.texte_ref = a.texte_ref
  WHERE a.chambre = 'senat'
    AND a.uid <> ${uidAmendementSenatSql('a', 't')}`;

/**
 * Amendements de commission du Sénat déposés depuis 90 jours. La synchro n'en
 * lisait aucun du 11/02 au 22/11/2026 ; 90 jours couvrent la suspension d'août.
 */
export const AMENDEMENTS_COMMISSION_SENAT_RECENTS_SQL = `
  SELECT count(*)::int AS value
  FROM amendements
  WHERE chambre = 'senat'
    AND numero LIKE 'COM-%'
    AND date_depot >= now() - interval '90 days'`;
