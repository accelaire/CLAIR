'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Users, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { getGroupColor } from '@/lib/colors';

interface TopDeputesChartProps {
  filters: {
    groupe?: string;
    periode?: string;
    theme?: string;
  };
  expanded?: boolean;
  title?: string;
}

export function TopDeputesChart({ filters, expanded, title = 'Députés les plus actifs' }: TopDeputesChartProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-top-deputes', filters],
    queryFn: () => api.get('/analytics/top-deputes', { params: filters }).then((res) => res.data.data),
  });

  if (isLoading) {
    return (
      <div className={`rounded-xl border bg-card p-6 ${expanded ? 'col-span-2' : ''}`}>
        <div className="animate-pulse">
          <div className="h-5 w-48 bg-muted rounded mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const deputes = data || [];

  return (
    <div className={`rounded-xl border bg-card p-6 ${expanded ? 'col-span-2' : ''}`}>
      <h3 className="font-semibold mb-4">{title}</h3>

      {expanded ? (
        // Bar chart view for expanded
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={deputes.slice(0, 15)}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                dataKey="nom"
                type="category"
                tick={{ fontSize: 12 }}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="score" name="Score d'activité" radius={[0, 4, 4, 0]}>
                {deputes.slice(0, 15).map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={getGroupColor(entry.groupe, entry.couleur)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        // List view for compact
        <div className="space-y-3">
          {deputes.slice(0, 5).map((depute: any, index: number) => (
            <Link
              key={depute.id}
              href={`/deputes/${depute.slug}`}
              className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors group"
            >
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-bold">
                {index + 1}
              </div>
              <div className="relative w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                {depute.photoUrl ? (
                  <Image
                    src={depute.photoUrl}
                    alt={depute.nom}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <Users className="absolute inset-0 m-auto h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                  {depute.prenom} {depute.nom}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {depute.groupe && (
                    <>
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getGroupColor(depute.groupe, depute.couleur) }}
                      />
                      <span className="truncate">{depute.groupe}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-primary">{depute.score}</div>
                <div className="text-xs text-muted-foreground">votes</div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      )}

      {!expanded && deputes.length > 5 && (
        <button className="w-full mt-4 py-2 text-sm text-primary hover:underline">
          Voir tous les députés →
        </button>
      )}
    </div>
  );
}
