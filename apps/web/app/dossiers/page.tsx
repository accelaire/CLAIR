'use client';

import { Suspense, useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Search, ChevronDown, Calendar, FileText, Vote, Loader2, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { DateRangePicker, dateRangeToParams } from '@/components/DateRangePicker';
import { useUrlFilters, useUrlDateRange } from '@/hooks/useUrlFilters';
import { FilterBar } from '@/components/FilterBar';

interface Dossier {
  id: string;
  uid: string;
  titre: string;
  titreCourt: string | null;
  chambre: string;
  procedureCode: string | null;
  procedureLibelle: string | null;
  etat: string | null;
  dateDepot: string | null;
  lastScrutinDate: string | null;
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

import { DOSSIER_ETAT_CONFIG, getDossierEtat } from '@/lib/dossiers';

const etatLabels = DOSSIER_ETAT_CONFIG;

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
  const [filters, setFilter, , clearAll] = useUrlFilters<{
    search: string;
    etat: string;
    chambre: string;
    procedureCode: string;
    procedureLibelle: string;
  }>(['search', 'etat', 'chambre', 'procedureCode', 'procedureLibelle']);

  const { data: filtersData } = useQuery<{ procedures: { label: string; count: number }[] }>({
    queryKey: ['dossiers-filters'],
    queryFn: () => api.get('/dossiers/filters').then(res => res.data),
    staleTime: 60000,
  });

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
          chambre: filters.chambre || undefined,
          procedureCode: filters.procedureCode || undefined,
          procedureLibelle: filters.procedureLibelle || undefined,
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

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.chambre) count++;
    if (filters.etat) count++;
    if (filters.procedureLibelle) count++;
    if (dateRange.from || dateRange.to) count++;
    return count;
  }, [filters.chambre, filters.etat, filters.procedureLibelle, dateRange.from, dateRange.to]);

  const handleClearFilters = () => {
    clearAll(['dateFrom', 'dateTo']);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dossiers législatifs</h1>
        <p className="mt-2 text-muted-foreground">
          {total > 0 ? total.toLocaleString('fr-FR') : '\u2014'} dossiers avec des scrutins associés
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Sources : <a href="https://data.assemblee-nationale.fr" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">data.assemblee-nationale.fr</a>, <a href="https://data.senat.fr" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">data.senat.fr</a>
          {' · '}<Link href="/comprendre/dossier-legislatif" className="underline hover:text-foreground">Comment fonctionne un dossier législatif ?</Link>
        </p>
      </div>

      {/* Filtres */}
      <FilterBar
        activeFilterCount={activeFilterCount}
        onClear={handleClearFilters}
        search={
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
        }
      >
        {/* Filtre par chambre */}
        <div className="relative md:w-auto">
          <select
            value={filters.chambre}
            onChange={(e) => setFilter('chambre', e.target.value)}
            className="w-full appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Toutes les chambres</option>
            <option value="assemblee">Assemblée nationale</option>
            <option value="senat">Sénat</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Filtre par état */}
        <div className="relative md:w-auto">
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
            <option value="caduc">Caduc</option>
            <option value="fusionne">Fusionné</option>
            <option value="retire">Retiré</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Filtre par procédure */}
        {filtersData?.procedures && filtersData.procedures.length > 0 && (
          <div className="relative md:w-auto md:max-w-[220px]">
            <select
              value={filters.procedureLibelle}
              onChange={(e) => setFilter('procedureLibelle', e.target.value)}
              className="w-full appearance-none truncate rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Toutes les procédures</option>
              {filtersData.procedures.map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label} ({p.count})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        )}

        {/* Filtre par période */}
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          placeholder="Période"
        />
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
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${dossier.chambre === 'senat' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {dossier.chambre === 'senat' ? 'Sénat' : 'AN'}
                      </span>
                      {dossier.etat && (
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${etatLabels[dossier.etat]?.color || 'bg-muted text-muted-foreground'}`}>
                          {etatLabels[dossier.etat]?.label || dossier.etat}
                        </span>
                      )}
                      {dossier.procedureLibelle && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded">
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
                      {dossier.lastScrutinDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Dernier vote : {formatDate(dossier.lastScrutinDate)}
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
