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
      <div className={`rounded-xl border bg-card p-6 ${expanded ? 'col-span-2' : ''}`}>
        <div className="animate-pulse">
          <div className="h-5 w-48 bg-muted rounded mb-4" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  const chartData = (data || []).slice(0, expanded ? 15 : 8).map((item: any, i: number) => ({
    ...item,
    color: SECTOR_COLORS[i % SECTOR_COLORS.length],
    // Shorten long sector names
    shortName: item.secteur?.length > 25
      ? item.secteur.substring(0, 25) + '...'
      : item.secteur,
  }));

  return (
    <div className={`rounded-xl border bg-card p-6 ${expanded ? 'col-span-2' : ''}`}>
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">Secteurs de lobbying</h3>
      </div>

      <div className={`${expanded ? 'h-96' : 'h-64'}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: expanded ? 150 : 100, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              dataKey="shortName"
              type="category"
              tick={{ fontSize: 11 }}
              width={expanded ? 140 : 90}
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
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Top {chartData.length} secteurs par nombre de lobbyistes enregistrés
        </p>
      )}
    </div>
  );
}
