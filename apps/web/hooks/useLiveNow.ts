'use client';

import { useQuery } from '@tanstack/react-query';
import type { LiveNowResponse } from '@/lib/live-url';

/** Les directs en cours, relus toutes les 5 minutes. À rapprocher par `directsDesReunions`. */
export function useLiveNow(): LiveNowResponse | undefined {
  const { data } = useQuery<LiveNowResponse>({
    queryKey: ['live-now'],
    queryFn: async () => {
      const res = await fetch('/api/live-now');
      if (!res.ok) throw new Error(`live-now : HTTP ${res.status}`);
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });
  return data;
}
