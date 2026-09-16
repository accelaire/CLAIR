// =============================================================================
// Le compte rendu d'une réunion, chez la chambre qui l'a publié
// =============================================================================
//
// Quatre formes de référence cohabitent dans `reunions.compte_rendu_ref`, et
// chacune ouvre un chemin différent. Deux copies divergentes de cette règle
// vivaient dans le front — la page d'une commission et la carte de l'agenda —
// et aucune des deux n'était juste :
//
// - la page de commission devinait `/dyn/17/comptes-rendus/CRC/<ref>`, un
//   chemin qui n'existe pas : 404 sur les 2 875 réunions de commission de
//   l'Assemblée ;
// - la carte d'agenda, elle, ne connaissait pas du tout les références de
//   commission et n'affichait donc aucun lien.
//
// Chaque forme ci-dessous a été vérifiée sur le site concerné.
// =============================================================================

/**
 * L'URL publique du compte rendu d'une réunion, ou `null`.
 *
 * - `CRCANR…` — commission de l'Assemblée. `/dyn/docs/<ref>.html` redirige vers
 *   le compte rendu. On ne reconstruit pas sa cible : elle s'écrit
 *   `/dyn/17/comptes-rendus/cion_def/l17cion_def2526079_compte-rendu`, où
 *   `cion_def` est un raccourci d'organe qui ne figure nulle part dans nos
 *   données et change d'une commission à l'autre. C'est la même raison qui nous
 *   fait lire ce lien sur la page de notice à l'ingestion.
 * - `CRSANR…` — séance de l'Assemblée, qui a son propre chemin.
 * - `https://…` — le Sénat range directement l'URL dans le champ.
 * - `CRSSNR…20260721` — séance du Sénat, dont la date termine la référence.
 *   La forme `_mono` donne la séance entière sur une page, et c'est celle dont
 *   nos propres prises de parole tirent leur `sourceUrl`.
 *
 * La législature se lit dans la référence plutôt que d'être figée à 17 : une
 * réunion de la 16e est déjà en base.
 */
export function urlDuCompteRendu(ref: string | null | undefined): string | null {
  if (!ref) return null;
  if (ref.startsWith('http')) return ref;

  if (ref.startsWith('CRCANR')) {
    return `https://www.assemblee-nationale.fr/dyn/docs/${ref}.html`;
  }

  if (ref.startsWith('CRSANR')) {
    const legislature = /L(\d+)/.exec(ref)?.[1] ?? '17';
    return `https://www.assemblee-nationale.fr/dyn/${legislature}/comptes-rendus/seance/${ref}`;
  }

  if (ref.startsWith('CRSSNR')) {
    const jour = /(\d{8})$/.exec(ref)?.[1];
    return jour ? `https://www.senat.fr/cra/s${jour}/s${jour}_mono.html` : null;
  }

  return null;
}
