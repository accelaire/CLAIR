'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Vote, TrendingUp, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

interface ScrutinsHeatmapProps {
  filters: {
    groupe?: string;
    periode?: string;
    theme?: string;
  };
  expanded?: boolean;
}

export function ScrutinsHeatmap({ filters, expanded }: ScrutinsHeatmapProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-scrutins', filters],
    queryFn: () => api.get('/analytics/scrutins', { params: filters }).then((res) => res.data.data),
  });

  if (isLoading) {
    return (
      <div className={`rounded-xl border bg-card p-4 sm:p-6 overflow-hidden min-w-0 ${expanded ? 'col-span-2' : ''}`}>
        <div className="animate-pulse">
          <div className="h-5 w-32 bg-muted rounded mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const scrutins = data?.recentScrutins || [];
  const stats = data?.stats || {};

  return (
    <div className={`rounded-xl border bg-card p-4 sm:p-6 overflow-hidden min-w-0 ${expanded ? 'col-span-2' : ''}`}>
      <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
        <div className="flex items-center gap-2">
          <Vote className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
          <h3 className="text-sm sm:text-base font-semibold">Scrutins récents</h3>
        </div>
        {stats.totalScrutins && (
          <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
            {stats.totalScrutins} au total
          </span>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div className="p-2 sm:p-3 rounded-lg bg-green-500/10">
          <div className="text-base sm:text-lg font-bold text-green-600">{stats.adoptes || 0}</div>
          <div className="text-[10px] sm:text-xs text-muted-foreground">Adoptés</div>
        </div>
        <div className="p-2 sm:p-3 rounded-lg bg-red-500/10">
          <div className="text-base sm:text-lg font-bold text-red-600">{stats.rejetes || 0}</div>
          <div className="text-[10px] sm:text-xs text-muted-foreground">Rejetés</div>
        </div>
        <div className="p-2 sm:p-3 rounded-lg bg-amber-500/10">
          <div className="text-base sm:text-lg font-bold text-amber-600">{stats.serres || 0}</div>
          <div className="text-[10px] sm:text-xs text-muted-foreground">Serrés</div>
        </div>
      </div>

      {/* Scrutins list */}
      <div className="space-y-2">
        {scrutins.slice(0, expanded ? 10 : 5).map((scrutin: any) => {
          const total = scrutin.pour + scrutin.contre + scrutin.abstention;
          const pourPct = total > 0 ? (scrutin.pour / total) * 100 : 0;
          const contrePct = total > 0 ? (scrutin.contre / total) * 100 : 0;
          const isControverted = Math.abs(pourPct - contrePct) < 20;

          return (
            <Link
              key={scrutin.id}
              href={`/scrutins/${scrutin.numero}`}
              className="block p-2 sm:p-3 rounded-lg border hover:border-primary/50 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between gap-2 sm:gap-3 mb-1.5 sm:mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span className="text-[10px] sm:text-xs font-mono text-muted-foreground">
                      #{scrutin.numero}
                    </span>
                    {isControverted && (
                      <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1 sm:px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] sm:text-xs">
                        <AlertTriangle className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        Serré
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {scrutin.titre}
                  </p>
                </div>
                <div className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium whitespace-nowrap ${
                  scrutin.sort === 'adopte'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {scrutin.sort === 'adopte' ? 'Adopté' : 'Rejeté'}
                </div>
              </div>

              {/* Vote bar */}
              <div className="flex h-1.5 sm:h-2 rounded-full overflow-hidden bg-muted">
                <div
                  className="bg-green-500 transition-all"
                  style={{ width: `${pourPct}%` }}
                />
                <div
                  className="bg-red-500 transition-all"
                  style={{ width: `${contrePct}%` }}
                />
                <div
                  className="bg-amber-500 transition-all"
                  style={{ width: `${100 - pourPct - contrePct}%` }}
                />
              </div>

              <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground mt-1">
                <span className="text-green-600">{scrutin.pour} pour</span>
                <span className="text-red-600">{scrutin.contre} contre</span>
                <span className="text-amber-600">{scrutin.abstention} abst.</span>
              </div>
            </Link>
          );
        })}
      </div>

      {!expanded && scrutins.length > 5 && (
        <Link
          href="/scrutins"
          className="block w-full mt-3 sm:mt-4 py-2 text-xs sm:text-sm text-center text-primary hover:underline"
        >
          Voir tous les scrutins →
        </Link>
      )}
    </div>
  );
}
