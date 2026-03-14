'use client';

import { normalizeAmendementSort, getAmendementSortClasses } from '@/lib/amendements';

interface AmendementSortBadgeProps {
  sort: string | null;
}

export function AmendementSortBadge({ sort }: AmendementSortBadgeProps) {
  if (!sort) return null;

  const label = normalizeAmendementSort(sort);
  const className = getAmendementSortClasses(sort);

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
