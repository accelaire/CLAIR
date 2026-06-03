interface LiveMatchable {
  type: string;
  dateDebut: string;
  compteRenduRef?: string | null;
  commission?: { organeRef?: string | null; chambre?: string | null } | null;
}

export function matchLiveUrl(
  reunion: LiveMatchable,
  liveByOrganeRef: Map<string, string>,
  liveBySeanceKey: Map<string, string>,
  liveBySeanceDate: Map<string, string>,
): string | undefined {
  if (reunion.commission?.organeRef) {
    const url = liveByOrganeRef.get(reunion.commission.organeRef);
    if (url) return url;
  }

  const chambre = reunion.commission?.chambre;
  if (!chambre) return undefined;

  const isoDate = new Date(reunion.dateDebut).toISOString().slice(0, 10);
  const match = reunion.compteRenduRef?.match(/N(\d+)$/);
  if (match) {
    const url = liveBySeanceKey.get(`${chambre}|${isoDate}|${parseInt(match[1]!, 10)}`);
    if (url) return url;
  }
  if (reunion.type === 'seance') {
    return liveBySeanceDate.get(`${chambre}|${isoDate}`);
  }
  return undefined;
}
