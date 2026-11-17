/**
 * Minuit à Paris, le jour de `date`, en instant UTC.
 *
 * Le décalage est celui de `date` : un jour de changement d'heure, minuit tombe
 * une heure à côté, ce qui ne change rien aux usages (bornes d'un planning).
 */
export function debutDuJourAParis(date: Date): Date {
  const jour = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  const decalage = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    timeZoneName: 'longOffset',
  })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName')
    ?.value.replace('GMT', '');
  return new Date(`${jour}T00:00:00${decalage || 'Z'}`);
}
