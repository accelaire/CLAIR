'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';

type FilterValue = string | null | undefined;

interface UseUrlFiltersOptions<T extends Record<string, FilterValue>> {
  /** Default values for filters */
  defaults?: Partial<T>;
}

/**
 * Hook to sync filters with URL query params.
 * This ensures filters are preserved when navigating back.
 */
export function useUrlFilters<T extends Record<string, FilterValue>>(
  keys: (keyof T)[],
  options: UseUrlFiltersOptions<T> = {}
): [T, (key: keyof T, value: FilterValue) => void, (updates: Partial<T>) => void, (extraKeys?: string[]) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Read current values from URL
  const values = useMemo(() => {
    const result = {} as T;
    for (const key of keys) {
      const urlValue = searchParams.get(key as string);
      result[key] = (urlValue ?? options.defaults?.[key] ?? '') as T[keyof T];
    }
    return result;
  }, [searchParams, keys, options.defaults]);

  // Update a single filter
  const setFilter = useCallback(
    (key: keyof T, value: FilterValue) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value && value !== '') {
        params.set(key as string, value);
      } else {
        params.delete(key as string);
      }

      // Use replace to avoid adding to history for filter changes
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  // Update multiple filters at once
  const setFilters = useCallback(
    (updates: Partial<T>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value && value !== '') {
          params.set(key, value as string);
        } else {
          params.delete(key);
        }
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  // Clear all registered keys + optional extra keys (e.g. 'dateFrom', 'dateTo') in one atomic replace
  const clearAll = useCallback(
    (extraKeys: string[] = []) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const key of keys) {
        params.delete(key as string);
      }
      for (const key of extraKeys) {
        params.delete(key);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname, keys]
  );

  return [values, setFilter, setFilters, clearAll];
}

/** Parse une date URL "YYYY-MM-DD" en date locale (minuit local, sans décalage de fuseau). */
function parseLocalDate(str: string | null): Date | null {
  if (!str) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  // Fallback pour d'éventuelles URLs legacy au format ISO complet
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/** Formate une date en "YYYY-MM-DD" dans le fuseau local. */
function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Hook for date range filter synced with URL.
 * Stores dateFrom and dateTo as URL params.
 */
export function useUrlDateRange(): [
  { from: Date | null; to: Date | null },
  (range: { from: Date | null; to: Date | null }) => void
] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const value = useMemo(() => {
    const fromStr = searchParams.get('dateFrom');
    const toStr = searchParams.get('dateTo');
    return {
      from: parseLocalDate(fromStr),
      to: parseLocalDate(toStr),
    };
  }, [searchParams]);

  const setValue = useCallback(
    (range: { from: Date | null; to: Date | null }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (range.from) {
        params.set('dateFrom', formatLocalDate(range.from));
      } else {
        params.delete('dateFrom');
      }

      if (range.to) {
        params.set('dateTo', formatLocalDate(range.to));
      } else {
        params.delete('dateTo');
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  return [value, setValue];
}

export default useUrlFilters;
