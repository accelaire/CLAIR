'use client';

import { useState, useMemo } from 'react';
import { Calendar, Filter } from 'lucide-react';

export type PeriodPreset = 'all' | 'week' | 'month' | '3months' | 'year' | 'custom';

export interface PeriodFilterValue {
  preset: PeriodPreset;
  dateFrom: string | null;
  dateTo: string | null;
}

interface PeriodFilterProps {
  value: PeriodFilterValue;
  onChange: (value: PeriodFilterValue) => void;
  showLabel?: boolean;
}

const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'all', label: 'Tout' },
  { value: 'week', label: '7 derniers jours' },
  { value: 'month', label: '30 derniers jours' },
  { value: '3months', label: '3 derniers mois' },
  { value: 'year', label: '12 derniers mois' },
  { value: 'custom', label: 'Personnalisé' },
];

function getPresetDates(preset: PeriodPreset): { dateFrom: string | null; dateTo: string | null } {
  const now = new Date();
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  switch (preset) {
    case 'week': {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { dateFrom: formatDate(weekAgo), dateTo: formatDate(now) };
    }
    case 'month': {
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return { dateFrom: formatDate(monthAgo), dateTo: formatDate(now) };
    }
    case '3months': {
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      return { dateFrom: formatDate(threeMonthsAgo), dateTo: formatDate(now) };
    }
    case 'year': {
      const yearAgo = new Date(now);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      return { dateFrom: formatDate(yearAgo), dateTo: formatDate(now) };
    }
    case 'all':
    default:
      return { dateFrom: null, dateTo: null };
  }
}

export function PeriodFilter({ value, onChange, showLabel = true }: PeriodFilterProps) {
  const [showCustom, setShowCustom] = useState(value.preset === 'custom');

  const handlePresetChange = (preset: PeriodPreset) => {
    if (preset === 'custom') {
      setShowCustom(true);
      onChange({ preset, dateFrom: value.dateFrom, dateTo: value.dateTo });
    } else {
      setShowCustom(false);
      const { dateFrom, dateTo } = getPresetDates(preset);
      onChange({ preset, dateFrom, dateTo });
    }
  };

  const handleDateChange = (field: 'dateFrom' | 'dateTo', dateValue: string) => {
    onChange({
      ...value,
      preset: 'custom',
      [field]: dateValue || null,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {showLabel && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>Période :</span>
        </div>
      )}

      <select
        value={value.preset}
        onChange={(e) => handlePresetChange(e.target.value as PeriodPreset)}
        className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        {PERIOD_PRESETS.map((preset) => (
          <option key={preset.value} value={preset.value}>
            {preset.label}
          </option>
        ))}
      </select>

      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={value.dateFrom || ''}
            onChange={(e) => handleDateChange('dateFrom', e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <span className="text-muted-foreground">-</span>
          <input
            type="date"
            value={value.dateTo || ''}
            onChange={(e) => handleDateChange('dateTo', e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      )}
    </div>
  );
}

export function usePeriodFilter(initialPreset: PeriodPreset = 'all'): [PeriodFilterValue, (v: PeriodFilterValue) => void] {
  const initialDates = useMemo(() => getPresetDates(initialPreset), [initialPreset]);
  const [value, setValue] = useState<PeriodFilterValue>({
    preset: initialPreset,
    ...initialDates,
  });
  return [value, setValue];
}

export default PeriodFilter;
