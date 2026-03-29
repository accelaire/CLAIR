// =============================================================================
// Normalisation des statuts d'amendements (AN + Sénat)
//
// AN: 36 valeurs en français avec casse mixte (ex: "Rejeté", "Cavalier (45)")
// Sénat: 11 valeurs en snake_case (ex: "rejete", "cet_amendement_est_retiré_avant_séance")
// =============================================================================

/**
 * Mapping exhaustif : clé = sort.toLowerCase(), valeur = label affiché.
 * Couvre les 47 valeurs distinctes relevées en base (mars 2026).
 */
const SORT_LABELS: Record<string, string> = {
  // ── Sénat (snake_case) ──────────────────────────────────────────────
  'adopte':                                    'Adopté',
  'adopte_modifie':                            'Adopté modifié',
  'rejete':                                    'Rejeté',
  'retire':                                    'Retiré',
  'tombe':                                     'Tombé',
  'irrecevable':                               'Irrecevable',
  'non_soutenu':                               'Non soutenu',
  'satisfait':                                 'Satisfait',
  'effacé':                                    'Effacé',
  'cet_amendement_est_retiré_avant_séance':    'Retiré avant séance',
  'en_attente_de_recevabilité_financière':     'En attente de recevabilité',
  'recevable_art._40_c_/_lolf':               'Recevable (art. 40 LOLF)',

  // ── AN — abréviations et formes ambiguës ────────────────────────────
  'r':                                         'Retiré',

  // ── AN — irrecevabilités (formes abrégées) ──────────────────────────
  'irr en première partie':                    'Irrecevable en 1re partie',
  'irr en seconde partie':                     'Irrecevable en 2e partie',
  'autres irr lolf':                           'Irrecevable (LOLF)',
  'autres irr lolfss':                         'Irrecevable (LOLFSS)',
  'autre irrecevabilité 40':                   'Irrecevable (art. 40)',
};

/**
 * Convertit un sort brut en label lisible.
 * 1. Lookup exact (lowercase) dans le mapping
 * 2. Fallback snake_case → espaces + majuscule initiale
 * 3. Sinon retour tel quel (AN, déjà lisible)
 */
export function normalizeAmendementSort(sort: string): string {
  const trimmed = sort.trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  if (SORT_LABELS[lower]) return SORT_LABELS[lower];

  // Snake_case générique (futur-proof Sénat) → espaces + majuscule
  if (trimmed.includes('_')) {
    return trimmed
      .replace(/_/g, ' ')
      .replace(/^\w/, c => c.toUpperCase());
  }

  // AN: déjà en français lisible
  return trimmed;
}

// ── Couleurs de badge ─────────────────────────────────────────────────
//
// Groupement sémantique :
//   vert     → adopté / recevable
//   rouge    → rejeté
//   jaune    → retiré (toutes formes)
//   orange   → tombé / entonnoir / effacé
//   bleu     → en traitement / à discuter / en attente
//   ardoise  → irrecevable / cavalier / charge / gage / crédits / hors-*
//   gris     → non soutenu / satisfait / doublon / sous-amendement / autre

export function getAmendementSortClasses(sort: string): string {
  const lower = sort.toLowerCase();

  // Vert : adopté, recevable
  if (lower.includes('adopt') || lower.startsWith('recevable')) {
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  }

  // Rouge : rejeté
  if (lower.includes('rejet') || lower === 'rejete') {
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  }

  // Jaune : retiré (toutes formes AN + Sénat)
  if (lower.includes('retir') || lower === 'retire' || lower === 'r'
    || lower.includes('retiré_avant_séance')) {
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
  }

  // Orange : tombé, entonnoir, effacé
  if (lower.includes('tomb') || lower.includes('entonnoir') || lower.includes('effac')) {
    return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
  }

  // Bleu : en traitement, à discuter, en attente
  if (lower.includes('traitement') || lower.includes('discuter')
    || lower.includes('attente')) {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
  }

  // Ardoise : irrecevable (toutes formes), cavalier, charge, gage, crédits,
  //           hors champ, hors-délais, disposition réglementaire, injonction,
  //           domaine, ratification, ordre du jour, champ de l'habilitation
  if (lower.includes('irr') || lower.includes('irrecevab')
    || lower.includes('cavalier') || lower === 'charge'
    || lower === 'gage' || lower === 'crédits'
    || lower.includes('hors') || lower.includes('disposition')
    || lower.includes('injonction') || lower.includes('domaine')
    || lower.includes('ratification') || lower.includes('ordre du jour')
    || lower.includes('habilitation')) {
    return 'bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-300';
  }

  // Gris : non soutenu, satisfait, doublon, sous-amendement, autre
  return 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400';
}
