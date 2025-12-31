'use client';

import { useQuery } from '@tanstack/react-query';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { api } from '@/lib/api';
import { getGroupColor } from '@/lib/colors';

interface GroupDistributionChartProps {
  filters: {
    groupe?: string;
    periode?: string;
    theme?: string;
  };
  expanded?: boolean;
}

export function GroupDistributionChart({ filters, expanded }: GroupDistributionChartProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-groupes', filters],
    queryFn: () => api.get('/analytics/groupes', { params: filters }).then((res) => res.data.data),
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

  const chartData = data?.map((g: any) => ({
    name: g.nom,
    value: g.nbDeputes,
    color: getGroupColor(g.nom, g.couleur, g.position),
  })) || [];

  return (
    <div className={`rounded-xl border bg-card p-6 ${expanded ? 'col-span-2' : ''}`}>
      <h3 className="font-semibold mb-4">Répartition par groupe politique</h3>

      <div className={`${expanded ? 'h-96' : 'h-64'}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={expanded ? 80 : 50}
              outerRadius={expanded ? 140 : 90}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) =>
                percent > 0.05 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''
              }
              labelLine={false}
            >
              {chartData.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`${value} députés`, 'Effectif']}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 justify-center">
        {chartData.slice(0, 6).map((item: any) => (
          <div key={item.name} className="flex items-center gap-1.5 text-xs">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted-foreground">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
