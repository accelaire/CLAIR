'use client';

import { useQuery } from '@tanstack/react-query';

interface LiveNowCommission {
  organeRef: string;
  directUrl: string;
}

interface LiveNowSeance {
  isoDate: string;
  order: number;
  directUrl: string;
}

interface LiveNowResponse {
  commissions: LiveNowCommission[];
  seances: LiveNowSeance[];
}

export function useLiveNow() {
  const { data } = useQuery<LiveNowResponse>({
    queryKey: ['live-now'],
    queryFn: () => fetch('/api/live-now').then(r => r.json()),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });

  const liveByOrganeRef = new Map<string, string>();
  const liveBySeanceKey = new Map<string, string>();
  const liveBySeanceDate = new Map<string, string>();

  if (data) {
    for (const c of data.commissions) {
      liveByOrganeRef.set(c.organeRef, c.directUrl);
    }
    for (const s of data.seances) {
      liveBySeanceKey.set(`${s.isoDate}|${s.order}`, s.directUrl);
      if (!liveBySeanceDate.has(s.isoDate)) liveBySeanceDate.set(s.isoDate, s.directUrl);
    }
  }

  return { liveByOrganeRef, liveBySeanceKey, liveBySeanceDate };
}