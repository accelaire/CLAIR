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
      <div className={`rounded-xl border bg-card p-4 sm:p-6 overflow-hidden min-w-0 ${expanded ? 'col-span-2' : ''}`}>
        <div className="animate-pulse">
          <div className="h-5 w-32 bg-muted rounded mb-4" />
          <div className="h-48 sm:h-64 bg-muted rounded" />
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
    <div className={`rounded-xl border bg-card p-4 sm:p-6 overflow-hidden min-w-0 ${expanded ? 'col-span-2' : ''}`}>
      <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4 truncate">Répartition par groupe</h3>

      <div className={`${expanded ? 'h-72 sm:h-96' : 'h-48 sm:h-64'}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={expanded ? 60 : 35}
              outerRadius={expanded ? 100 : 70}
              paddingAngle={2}
              dataKey="value"
              label={false}
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
                fontSize: '12px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 sm:gap-3 mt-3 sm:mt-4 justify-center">
        {chartData.slice(0, 6).map((item: any) => (
          <div key={item.name} className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs">
            <div
              className="w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted-foreground truncate max-w-[80px] sm:max-w-none">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
