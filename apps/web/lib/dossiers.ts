// =============================================================================
// États des dossiers législatifs
// =============================================================================

export const DOSSIER_ETAT_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  en_cours:  { label: 'En cours',   color: 'bg-amber-100 text-amber-700',  dotColor: 'bg-amber-500' },
  adopte:    { label: 'Adopté',     color: 'bg-blue-100 text-blue-700',    dotColor: 'bg-blue-500' },
  rejete:    { label: 'Rejeté',     color: 'bg-red-100 text-red-700',      dotColor: 'bg-red-500' },
  promulgue: { label: 'Promulgué',  color: 'bg-green-100 text-green-700',  dotColor: 'bg-green-500' },
  caduc:     { label: 'Caduc',      color: 'bg-gray-100 text-gray-600',    dotColor: 'bg-gray-400' },
  fusionne:  { label: 'Fusionné',   color: 'bg-purple-100 text-purple-700', dotColor: 'bg-purple-500' },
  retire:    { label: 'Retiré',     color: 'bg-orange-100 text-orange-700', dotColor: 'bg-orange-500' },
};

export function getDossierEtat(etat: string | null | undefined) {
  if (!etat) return null;
  return DOSSIER_ETAT_CONFIG[etat] ?? { label: etat, color: 'bg-gray-100 text-gray-600', dotColor: 'bg-gray-400' };
}
