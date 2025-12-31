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
      <div className={`rounded-xl border bg-card p-6 ${expanded ? 'col-span-2' : ''}`}>
        <div className="animate-pulse">
          <div className="h-5 w-48 bg-muted rounded mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const scrutins = data?.recentScrutins || [];
  const stats = data?.stats || {};

  return (
    <div className={`rounded-xl border bg-card p-6 ${expanded ? 'col-span-2' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Vote className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Scrutins récents</h3>
        </div>
        {stats.totalScrutins && (
          <span className="text-sm text-muted-foreground">
            {stats.totalScrutins} scrutins au total
          </span>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-green-500/10">
          <div className="text-lg font-bold text-green-600">{stats.adoptes || 0}</div>
          <div className="text-xs text-muted-foreground">Adoptés</div>
        </div>
        <div className="p-3 rounded-lg bg-red-500/10">
          <div className="text-lg font-bold text-red-600">{stats.rejetes || 0}</div>
          <div className="text-xs text-muted-foreground">Rejetés</div>
        </div>
        <div className="p-3 rounded-lg bg-amber-500/10">
          <div className="text-lg font-bold text-amber-600">{stats.serres || 0}</div>
          <div className="text-xs text-muted-foreground">Serrés</div>
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
              className="block p-3 rounded-lg border hover:border-primary/50 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">
                      #{scrutin.numero}
                    </span>
                    {isControverted && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs">
                        <AlertTriangle className="h-3 w-3" />
                        Serré
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {scrutin.titre}
                  </p>
                </div>
                <div className={`px-2 py-0.5 rounded text-xs font-medium ${
                  scrutin.sort === 'adopte'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {scrutin.sort === 'adopte' ? 'Adopté' : 'Rejeté'}
                </div>
              </div>

              {/* Vote bar */}
              <div className="flex h-2 rounded-full overflow-hidden bg-muted">
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

              <div className="flex justify-between text-xs text-muted-foreground mt-1">
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
          className="block w-full mt-4 py-2 text-sm text-center text-primary hover:underline"
        >
          Voir tous les scrutins →
        </Link>
      )}
    </div>
  );
}
