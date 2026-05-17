interface ChambreReunion {
  commission?: { chambre?: string } | null;
  compteRenduRef?: string | null;
  urlVideo?: string | null;
  lieu?: string | null;
}

export function deriveChambre(reunion: ChambreReunion): string | null {
  if (reunion.commission?.chambre) return reunion.commission.chambre;
  if (reunion.compteRenduRef?.startsWith('CRSA')) return 'assemblee';
  if (reunion.compteRenduRef?.startsWith('CRSS')) return 'senat';
  if (reunion.urlVideo?.includes('assemblee-nationale.fr')) return 'assemblee';
  if (reunion.urlVideo?.includes('senat.fr')) return 'senat';
  if (reunion.lieu?.includes('Palais Bourbon') || reunion.lieu?.includes('Assemblée nationale')) return 'assemblee';
  if (reunion.lieu?.includes('Palais du Luxembourg') || reunion.lieu?.includes('Sénat')) return 'senat';
  return null;
}
