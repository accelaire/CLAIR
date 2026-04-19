import { fetchFromApi } from './api-server';
import type { ScrutinListItem } from '@/components/scrutins/ScrutinListCard';

interface ScrutinsResponse {
  data: ScrutinListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
  };
}

export const MONTH_NAMES_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

export const MIN_ARCHIVE_YEAR = 2012;
export const MAX_ARCHIVE_YEAR = new Date().getFullYear();

/**
 * Page size for year archives. Kept small so a single fetch stays well
 * under Next.js 2 MB data-cache ceiling and the rendered DOM remains light.
 */
export const YEAR_ARCHIVE_PAGE_SIZE = 50;

/**
 * Month archives rarely exceed this count, so most months fit in one fetch.
 * When they don't, we paginate just like year archives.
 */
export const MONTH_ARCHIVE_PAGE_SIZE = 50;

export function isValidArchiveYear(year: number): boolean {
  return (
    Number.isInteger(year) &&
    year >= MIN_ARCHIVE_YEAR &&
    year <= MAX_ARCHIVE_YEAR
  );
}

export function isValidMonth(month: number): boolean {
  return Number.isInteger(month) && month >= 1 && month <= 12;
}

export interface ArchivePage {
  scrutins: ScrutinListItem[];
  total: number;
  page: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Fetch a single page of scrutins in a date range. One round-trip per
 * render — the caller is responsible for paginating via URL.
 */
export async function fetchScrutinsPage(params: {
  from: string;
  to: string;
  page: number;
  limit: number;
}): Promise<ArchivePage> {
  const { from, to, page, limit } = params;
  const res = await fetchFromApi<ScrutinsResponse>(
    `/scrutins?dateFrom=${from}&dateTo=${to}&limit=${limit}&page=${page}`,
    86400,
  );

  const scrutins = res?.data ?? [];
  const total = res?.meta?.total ?? scrutins.length;
  const totalPages = res?.meta?.totalPages ?? 1;
  const hasNext = res?.meta?.hasNext ?? false;
  return {
    scrutins,
    total,
    page,
    totalPages,
    hasNext,
    hasPrev: page > 1,
  };
}

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function parsePageParam(raw: string | string[] | undefined): number {
  if (!raw) return 1;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!/^\d+$/.test(value)) return 1;
  const n = parseInt(value, 10);
  return n >= 1 && n <= 10_000 ? n : 1;
}
