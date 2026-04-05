'use client';

import { ChevronDown } from 'lucide-react';

export interface SortOption {
  value: string;
  label: string;
}

interface SortSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SortOption[];
  className?: string;
}

export function SortSelect({ value, onChange, options, className = '' }: SortSelectProps) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border bg-background px-4 py-2 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
    </div>
  );
}

export const PARLEMENTAIRE_SORT_OPTIONS: SortOption[] = [
  { value: 'presence', label: 'Présence' },
  { value: 'loyaute', label: 'Loyauté' },
  { value: 'amendements', label: 'Amendements' },
  { value: 'interventions', label: 'Interventions' },
  { value: 'nom', label: 'Alphabétique' },
];

export const MEMBRE_SORT_OPTIONS: SortOption[] = [
  { value: 'nom', label: 'Alphabétique' },
  { value: 'presence', label: 'Présence' },
  { value: 'loyaute', label: 'Loyauté' },
];
