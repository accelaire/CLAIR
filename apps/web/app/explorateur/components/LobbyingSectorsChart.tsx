'use client';

import { useQuery } from '@tanstack/react-query';
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
import { Building2 } from 'lucide-react';
import { api } from '@/lib/api';

interface LobbyingSectorsChartProps {
  filters: {
    groupe?: string;
    periode?: string;
    theme?: string;
  };
  expanded?: boolean;
}

const SECTOR_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#6366f1',
  '#a855f7',
];

export function LobbyingSectorsChart({ filters, expanded }: LobbyingSectorsChartProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-lobbying-sectors', filters],
    queryFn: () => api.get('/analytics/lobbying-sectors', { params: filters }).then((res) => res.data.data),
  });

  if (isLoading) {
    return (
      <div className={`rounded-xl border bg-card p-4 sm:p-6 overflow-hidden min-w-0 ${expanded ? 'col-span-2' : ''}`}>
        <div className="animate-pulse">
          <div className="h-5 w-32 bg-muted rounded mb-4" />
          <div className="h-56 sm:h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  // On mobile, show fewer items and shorter names
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const maxNameLength = isMobile ? 15 : (expanded ? 25 : 20);
  const maxItems = isMobile ? 6 : (expanded ? 15 : 8);

  const chartData = (data || []).slice(0, maxItems).map((item: any, i: number) => ({
    ...item,
    color: SECTOR_COLORS[i % SECTOR_COLORS.length],
    // Shorten long sector names
    shortName: item.secteur?.length > maxNameLength
      ? item.secteur.substring(0, maxNameLength) + '...'
      : item.secteur,
  }));

  return (
    <div className={`rounded-xl border bg-card p-4 sm:p-6 overflow-hidden min-w-0 ${expanded ? 'col-span-2' : ''}`}>
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
        <h3 className="text-sm sm:text-base font-semibold truncate">Secteurs de lobbying</h3>
      </div>

      <div className={`${expanded ? 'h-80 sm:h-96' : 'h-56 sm:h-64'}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 10, left: 5, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis
              dataKey="shortName"
              type="category"
              tick={{ fontSize: 10 }}
              width={expanded ? 100 : 70}
            />
            <Tooltip
              formatter={(value: number, name: string, props: any) => [
                `${value} lobbyistes`,
                props.payload.secteur,
              ]}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="count" name="Lobbyistes" radius={[0, 4, 4, 0]}>
              {chartData.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {!expanded && (
        <p className="text-xs text-muted-foreground mt-3 sm:mt-4 text-center">
          Top {chartData.length} secteurs par nombre de lobbyistes
        </p>
      )}
    </div>
  );
}
