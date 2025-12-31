'use client';

import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface InsightCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: {
    value: number;
    label: string;
  } | null;
  onClick?: () => void;
}

export function InsightCard({ icon: Icon, label, value, trend, onClick }: InsightCardProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border bg-card p-4 transition-all ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-primary/50' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="p-2 rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs ${
            trend.value >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {trend.value >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
      <div className="text-2xl font-bold">
        {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
      {trend && (
        <div className="text-xs text-muted-foreground mt-1">{trend.label}</div>
      )}
    </div>
  );
}
