'use client';

import { Suspense } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Search, ChevronDown, Calendar, FileText, Vote, Loader2, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { DateRangePicker, dateRangeToParams } from '@/components/DateRangePicker';
import { useUrlFilters, useUrlDateRange } from '@/hooks/useUrlFilters';

interface Dossier {
  id: string;
  uid: string;
  titre: string;
  titreCourt: string | null;
  procedureCode: string | null;
  procedureLibelle: string | null;
  etat: string | null;
  dateDepot: string | null;
  loiNumero: string | null;
  _count: {
    scrutins: number;
    amendements: number;
  };
}

interface DossiersResponse {
  data: Dossier[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
  };
}

const etatLabels: Record<string, { label: string; color: string }> = {
  en_cours: { label: 'En cours', color: 'bg-amber-100 text-amber-700' },
  adopte: { label: 'Adopté', color: 'bg-blue-100 text-blue-700' },
  rejete: { label: 'Rejeté', color: 'bg-red-100 text-red-700' },
  promulgue: { label: 'Promulgué', color: 'bg-green-100 text-green-700' },
};

/** Construit un titre lisible : préfixe procedure si le titre commence en minuscule */
const formatDossierTitre = (titre: string, procedureLibelle?: string | null): string => {
  const firstChar = titre.charAt(0);
  if (firstChar !== firstChar.toUpperCase() && procedureLibelle) {
    return `${procedureLibelle} ${titre}`;
  }
  return titre;
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

function DossiersPageContent() {
  const [filters, setFilter] = useUrlFilters<{
    search: string;
    etat: string;
    procedureCode: string;
  }>(['search', 'etat', 'procedureCode']);

  const [dateRange, setDateRange] = useUrlDateRange();
  const dateParams = dateRangeToParams(dateRange);

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<DossiersResponse>({
    queryKey: ['dossiers', { ...filters, ...dateParams }],
    queryFn: ({ pageParam = 1 }) =>
      api.get('/dossiers', {
        params: {
          search: filters.search || undefined,
          etat: filters.etat || undefined,
          procedureCode: filters.procedureCode || undefined,
          page: pageParam,
          limit: 20,
          ...dateParams,
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

  const dossiers = data?.pages.flatMap((page) => page.data) ?? [];
  const total = data?.pages[0]?.meta.total ?? 0;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dossiers législatifs</h1>
        <p className="mt-2 text-muted-foreground">
          {total > 0 ? total.toLocaleString('fr-FR') : '\u2014'} dossiers avec des scrutins associés
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Source : <a href="https://data.assemblee-nationale.fr" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">data.assemblee-nationale.fr</a>
        </p>
      </div>

      {/* Filtres */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start">
        {/* Recherche */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher un dossier..."
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            className="w-full rounded-lg border bg-background px-10 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Filtre par état */}
        <div className="relative w-full sm:w-auto">
          <select
            value={filters.etat}
            onChange={(e) => setFilter('etat', e.target.value)}
            className="w-full appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tous les états</option>
            <option value="en_cours">En cours</option>
            <option value="adopte">Adopté</option>
            <option value="rejete">Rejeté</option>
            <option value="promulgue">Promulgué</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Filtre par periode */}
      <div className="mb-6">
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          placeholder="Période"
        />
      </div>

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
          Une erreur est survenue lors du chargement des dossiers.
        </div>
      )}

      {/* Liste */}
      {dossiers.length > 0 && (
        <>
          <div className="space-y-4">
            {dossiers.map((dossier) => (
              <Link
                key={dossier.id}
                href={`/dossiers/${dossier.uid}`}
                className="block rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Badges */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {dossier.etat && (
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${etatLabels[dossier.etat]?.color || 'bg-muted text-muted-foreground'}`}>
                          {etatLabels[dossier.etat]?.label || dossier.etat}
                        </span>
                      )}
                      {dossier.procedureLibelle && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                          {dossier.procedureLibelle}
                        </span>
                      )}
                    </div>

                    {/* Titre */}
                    <h3 className="font-semibold text-lg leading-tight mb-2 line-clamp-2">
                      {formatDossierTitre(dossier.titre, dossier.procedureLibelle)}
                    </h3>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      {dossier.dateDepot && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(dossier.dateDepot)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Vote className="h-4 w-4" />
                        {dossier._count.scrutins} scrutin{dossier._count.scrutins > 1 ? 's' : ''}
                      </span>
                      {dossier._count.amendements > 0 && (
                        <span className="flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          {dossier._count.amendements} amendement{dossier._count.amendements > 1 ? 's' : ''}
                        </span>
                      )}
                      {dossier.loiNumero && (
                        <span className="text-green-700 font-medium">
                          Loi n&deg;{dossier.loiNumero}
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
            {!hasNextPage && dossiers.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Tous les dossiers ont été chargés
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function DossiersPage() {
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
      <DossiersPageContent />
    </Suspense>
  );
}
