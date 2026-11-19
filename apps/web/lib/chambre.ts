interface ChambreReunion {
  uid?: string | null;
  commission?: { chambre?: string | null } | null;
  compteRenduRef?: string | null;
  urlVideo?: string | null;
  lieu?: string | null;
}

export function deriveChambre(reunion: ChambreReunion): string | null {
  if (reunion.commission?.chambre) return reunion.commission.chambre;
  // L'identifiant de la source dit la chambre : « RUANR5… » à l'AN, « RUSNR5… »
  // ou « SENAT_AGENDA_… » au Sénat. Utile aux réunions dont l'organe n'est pas
  // encore rattaché (missions, délégations de l'AN).
  if (reunion.uid?.startsWith('RUAN')) return 'assemblee';
  if (reunion.uid?.startsWith('RUSN') || reunion.uid?.startsWith('SENAT_')) return 'senat';
  if (reunion.compteRenduRef?.startsWith('CRSA')) return 'assemblee';
  if (reunion.compteRenduRef?.startsWith('CRSS')) return 'senat';
  if (reunion.urlVideo?.includes('assemblee-nationale.fr')) return 'assemblee';
  if (reunion.urlVideo?.includes('senat.fr')) return 'senat';
  if (reunion.lieu?.includes('Palais Bourbon') || reunion.lieu?.includes('Assemblée nationale')) return 'assemblee';
  if (reunion.lieu?.includes('Palais du Luxembourg') || reunion.lieu?.includes('Sénat')) return 'senat';
  return null;
}
