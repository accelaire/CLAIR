'use client';

import { Suspense, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Search, ChevronDown, Vote, Loader2, Layers, Calendar } from 'lucide-react';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { FilterBar } from '@/components/FilterBar';

interface Sujet {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  category: string | null;
  dossierCount: number;
  scrutinCount: number;
  matchMethod: string | null;
  status: string;
  dateDebut: string | null;
  dateFin: string | null;
  dateDernierVote: string | null;
  featured: boolean;
  featuredOrder: number;
  createdAt: string;
}

interface SujetsResponse {
  data: Sujet[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
  };
}

const MATCH_METHOD_LABELS: Record<string, { label: string; color: string }> = {
  cross_ref: { label: 'Cross-chambre', color: 'bg-indigo-100 text-indigo-700' },
  loi_numero: { label: 'Loi commune', color: 'bg-emerald-100 text-emerald-700' },
  solo: { label: 'Mono-chambre', color: 'bg-slate-100 text-slate-600' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  en_cours:  { label: 'En cours',   color: 'text-amber-700',  dot: 'bg-amber-500' },
  adopte:    { label: 'Adopté',     color: 'text-blue-700',   dot: 'bg-blue-500' },
  rejete:    { label: 'Rejeté',     color: 'text-red-700',    dot: 'bg-red-500' },
  promulgue: { label: 'Promulgué',  color: 'text-green-700',  dot: 'bg-green-500' },
  caduc:     { label: 'Caduc',      color: 'text-gray-500',   dot: 'bg-gray-400' },
  retire:    { label: 'Retiré',     color: 'text-orange-700', dot: 'bg-orange-500' },
};

const formatDateShort = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });

function SujetsPageContent() {
  const [filters, setFilter, , clearAll] = useUrlFilters<{
    search: string;
    matchMethod: string;
  }>(['search', 'matchMethod']);

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<SujetsResponse>({
    queryKey: ['sujets', { ...filters }],
    queryFn: ({ pageParam = 1 }) =>
      api.get('/sujets', {
        params: {
          search: filters.search || undefined,
          page: pageParam,
          limit: 24,
        },
      }).then((res) => res.data),
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
  });

  const { loadMoreRef } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  const sujets = data?.pages.flatMap((page) => page.data) ?? [];
  const total = data?.pages[0]?.meta.total ?? 0;

  const filteredSujets = useMemo(() => {
    if (!filters.matchMethod) return sujets;
    return sujets.filter(s => s.matchMethod === filters.matchMethod);
  }, [sujets, filters.matchMethod]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.matchMethod) count++;
    return count;
  }, [filters.matchMethod]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Sujets parlementaires</h1>
        <p className="mt-2 text-muted-foreground">
          {total > 0 ? total.toLocaleString('fr-FR') : '\u2014'} sujets regroupant les dossiers AN et S&eacute;nat sur un m&ecirc;me texte
        </p>
      </div>

      {/* Filtres */}
      <FilterBar
        activeFilterCount={activeFilterCount}
        onClear={() => clearAll()}
        search={
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher un sujet..."
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              className="w-full rounded-lg border bg-background px-10 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        }
      >
        <div className="relative md:w-auto">
          <select
            value={filters.matchMethod}
            onChange={(e) => setFilter('matchMethod', e.target.value)}
            className="w-full appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tous les types</option>
            <option value="cross_ref">Cross-chambre (AN + S&eacute;nat)</option>
            <option value="solo">Mono-chambre</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </FilterBar>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-5">
              <div className="h-4 w-20 rounded bg-muted mb-3" />
              <div className="h-5 w-full rounded bg-muted mb-2" />
              <div className="h-5 w-3/4 rounded bg-muted mb-4" />
              <div className="h-4 w-1/3 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Une erreur est survenue lors du chargement des sujets.
        </div>
      )}

      {/* Card grid */}
      {filteredSujets.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSujets.map((sujet) => {
              const statusCfg = STATUS_CONFIG[sujet.status] ?? STATUS_CONFIG.en_cours;

              return (
                <Link
                  key={sujet.id}
                  href={`/sujets/${sujet.slug}`}
                  className="group rounded-lg border bg-card p-5 transition-all hover:border-primary hover:shadow-md flex flex-col"
                >
                  {/* Status badge */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusCfg.color}`}>
                      <span className={`h-2 w-2 rounded-full ${statusCfg.dot}`} />
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-semibold leading-tight mb-auto line-clamp-3 group-hover:text-primary transition-colors">
                    {sujet.label}
                  </h3>

                  {/* Footer: key dates */}
                  <div className="flex flex-col gap-1.5 mt-4 pt-3 border-t text-[11px] text-muted-foreground">
                    <div className="flex items-center justify-between">
                      {sujet.dateDebut ? (
                        <span>D&eacute;p&ocirc;t : {formatDateShort(sujet.dateDebut)}</span>
                      ) : (
                        <span />
                      )}
                      <span className="flex items-center gap-1">
                        <Vote className="h-3 w-3" />
                        {sujet.scrutinCount} scrutin{sujet.scrutinCount > 1 ? 's' : ''}
                      </span>
                    </div>
                    {(sujet.dateDernierVote || sujet.dateFin) && (
                      <div className="flex items-center justify-between">
                        {sujet.dateDernierVote && (
                          <span>Dernier vote : {formatDateShort(sujet.dateDernierVote)}</span>
                        )}
                        {sujet.status === 'promulgue' && sujet.dateFin && (
                          <span className="text-green-700 font-medium">
                            Promulgu&eacute; {formatDateShort(sujet.dateFin)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Infinite scroll trigger */}
          <div ref={loadMoreRef} className="mt-8 flex justify-center py-4">
            {isFetchingNextPage && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Chargement...</span>
              </div>
            )}
            {!hasNextPage && sujets.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Tous les sujets ont &eacute;t&eacute; charg&eacute;s
              </p>
            )}
          </div>
        </>
      )}

      {/* Empty state */}
      {!isLoading && !error && filteredSujets.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Aucun sujet trouv&eacute;</p>
          <p className="mt-1">Essayez de modifier vos filtres de recherche.</p>
        </div>
      )}
    </div>
  );
}

export default function SujetsPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-5">
              <div className="h-4 w-20 rounded bg-muted mb-3" />
              <div className="h-5 w-full rounded bg-muted mb-2" />
              <div className="h-5 w-3/4 rounded bg-muted mb-4" />
              <div className="h-4 w-1/3 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    }>
      <SujetsPageContent />
    </Suspense>
  );
}
