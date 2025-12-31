'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { api } from '@/lib/api';

interface VotingTrendsChartProps {
  filters: {
    groupe?: string;
    periode?: string;
    theme?: string;
  };
  expanded?: boolean;
}

export function VotingTrendsChart({ filters, expanded }: VotingTrendsChartProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-voting-trends', filters],
    queryFn: () => api.get('/analytics/voting-trends', { params: filters }).then((res) => res.data.data),
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

  const chartData = data || [];

  return (
    <div className={`rounded-xl border bg-card p-6 ${expanded ? '' : ''}`}>
      <h3 className="font-semibold mb-4">Évolution des votes</h3>

      <div className={`${expanded ? 'h-96' : 'h-64'}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPour" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorContre" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorAbstention" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="mois"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="pour"
              name="Pour"
              stroke="#22c55e"
              fillOpacity={1}
              fill="url(#colorPour)"
            />
            <Area
              type="monotone"
              dataKey="contre"
              name="Contre"
              stroke="#ef4444"
              fillOpacity={1}
              fill="url(#colorContre)"
            />
            <Area
              type="monotone"
              dataKey="abstention"
              name="Abstention"
              stroke="#f59e0b"
              fillOpacity={1}
              fill="url(#colorAbstention)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
