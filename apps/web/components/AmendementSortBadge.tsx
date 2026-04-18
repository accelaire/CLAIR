'use client';

import Link from 'next/link';
import { normalizeAmendementSort, getAmendementSortClasses } from '@/lib/amendements';

interface AmendementSortBadgeProps {
  sort: string | null;
}

export function AmendementSortBadge({ sort }: AmendementSortBadgeProps) {
  if (!sort) return null;

  const label = normalizeAmendementSort(sort);
  const className = getAmendementSortClasses(sort);

  return (
    <Link
      href="/comprendre/dossier-legislatif#amendements-sort"
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className} hover:opacity-80 transition-opacity`}
    >
      {label}
    </Link>
  );
}
