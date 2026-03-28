// =============================================================================
// États des dossiers législatifs
// =============================================================================

export const DOSSIER_ETAT_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  en_cours:  { label: 'En cours',   color: 'badge-en-cours',  dotColor: 'bg-amber-500' },
  adopte:    { label: 'Adopté',     color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', dotColor: 'bg-blue-500' },
  rejete:    { label: 'Rejeté',     color: 'badge-rejete',    dotColor: 'bg-red-500' },
  promulgue: { label: 'Promulgué',  color: 'badge-promulgue', dotColor: 'bg-green-500' },
  caduc:     { label: 'Caduc',      color: 'badge-caduc',     dotColor: 'bg-gray-400' },
  fusionne:  { label: 'Fusionné',   color: 'badge-fusionne',  dotColor: 'bg-purple-500' },
  retire:    { label: 'Retiré',     color: 'badge-retire',    dotColor: 'bg-orange-500' },
};

export function getDossierEtat(etat: string | null | undefined) {
  if (!etat) return null;
  return DOSSIER_ETAT_CONFIG[etat] ?? { label: etat, color: 'badge-caduc', dotColor: 'bg-gray-400' };
}
