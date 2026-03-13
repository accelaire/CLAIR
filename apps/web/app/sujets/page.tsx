'use client';

import { Suspense, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Search, ChevronDown, Vote, FileText, Loader2, ArrowRight, Layers } from 'lucide-react';
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
  dateDebut: string | null;
  dateFin: string | null;
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
          limit: 20,
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

  // Client-side filter by matchMethod (API doesn't have this filter yet)
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
        <p className="mt-1 text-xs text-muted-foreground">
          Les sujets cross-chambre regroupent les dossiers de l&apos;Assembl&eacute;e nationale et du S&eacute;nat portant sur le m&ecirc;me texte de loi (navette parlementaire).
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
        {/* Filtre par type de match */}
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

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
              <div className="h-5 w-3/4 rounded bg-muted mb-2" />
              <div className="h-4 w-1/2 rounded bg-muted" />
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

      {/* Liste */}
      {filteredSujets.length > 0 && (
        <>
          <div className="space-y-4">
            {filteredSujets.map((sujet) => (
              <Link
                key={sujet.id}
                href={`/sujets/${sujet.slug}`}
                className="block rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Badges */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {sujet.matchMethod && MATCH_METHOD_LABELS[sujet.matchMethod] && (
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${MATCH_METHOD_LABELS[sujet.matchMethod].color}`}>
                          {MATCH_METHOD_LABELS[sujet.matchMethod].label}
                        </span>
                      )}
                      {sujet.category && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                          {sujet.category}
                        </span>
                      )}
                    </div>

                    {/* Titre */}
                    <h3 className="font-semibold text-lg leading-tight mb-2 line-clamp-2">
                      {sujet.label}
                    </h3>

                    {/* Description */}
                    {sujet.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {sujet.description}
                      </p>
                    )}

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        {sujet.dossierCount} dossier{sujet.dossierCount > 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Vote className="h-4 w-4" />
                        {sujet.scrutinCount} scrutin{sujet.scrutinCount > 1 ? 's' : ''}
                      </span>
                      {sujet.matchMethod === 'cross_ref' && (
                        <span className="flex items-center gap-1 text-indigo-600">
                          <Layers className="h-4 w-4" />
                          AN + S&eacute;nat
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center">
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            ))}
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
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
              <div className="h-5 w-3/4 rounded bg-muted mb-2" />
              <div className="h-4 w-1/2 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    }>
      <SujetsPageContent />
    </Suspense>
  );
}
