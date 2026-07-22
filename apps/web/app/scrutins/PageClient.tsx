'use client';

import { Suspense, useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Search, ChevronDown, Loader2, ArrowRight, Vote } from 'lucide-react';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { DateRangePicker, dateRangeToParams } from '@/components/DateRangePicker';
import { toPeriodePresets, type PeriodeApi } from '@/lib/periodes';
import { useUrlFilters, useUrlDateRange } from '@/hooks/useUrlFilters';
import { FilterBar } from '@/components/FilterBar';
import {
  ScrutinListCard,
  type ScrutinListItem,
} from '@/components/scrutins/ScrutinListCard';

interface TrendingDossier {
  id: string;
  uid: string;
  titre: string;
  titreCourt: string | null;
  etat: string | null;
  procedureLibelle: string | null;
  _count: { scrutins: number };
  lastScrutinDate: string | null;
}

const formatDossierTitre = (titre: string, procedureLibelle?: string | null): string => {
  const firstChar = titre.charAt(0);
  if (firstChar !== firstChar.toUpperCase() && procedureLibelle) {
    return `${procedureLibelle} ${titre}`;
  }
  return titre;
};

import { DOSSIER_ETAT_CONFIG } from '@/lib/dossiers';

const etatLabels = DOSSIER_ETAT_CONFIG;

interface Scrutin extends ScrutinListItem {
  nombreVotants: number;
  votesCount?: number;
}

interface ScrutinsResponse {
  data: Scrutin[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
  };
}

// Capitalize first letter of a string
const capitalize = (str: string): string => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
};

function ScrutinsPageContent() {
  // Sync filters with URL for back button preservation
  const [filters, setFilter, setFilters, clearAll] = useUrlFilters<{
    search: string;
    chambre: string;
    type: string;
    tag: string;
    dateFrom: string;
    dateTo: string;
  }>(['search', 'chambre', 'type', 'tag']);

  const [dateRange, setDateRange] = useUrlDateRange();
  const dateParams = dateRangeToParams(dateRange);

  // Fetch scrutins avec infinite scroll
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<ScrutinsResponse>({
    queryKey: ['scrutins', { ...filters, ...dateParams }],
    queryFn: ({ pageParam = 1 }) =>
      api.get('/scrutins', {
        params: {
          search: filters.search || undefined,
          chambre: filters.chambre || undefined,
          type: filters.type || undefined,
          tag: filters.tag || undefined,
          page: pageParam,
          limit: 20,
          ...dateParams,
        },
      }).then((res) => res.data),
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
  });

  // Fetch tags
  const { data: tagsData } = useQuery({
    queryKey: ['scrutins-tags'],
    queryFn: () => api.get('/scrutins/tags').then((res) => res.data.data),
  });

  // Périodes institutionnelles disponibles. Suit la chambre sélectionnée : on ne
  // propose que les législatures (AN) ou que les sessions (Sénat) quand une
  // chambre est active, les deux sinon.
  const { data: periodesData } = useQuery<{ data: PeriodeApi[] }>({
    queryKey: ['scrutins-periodes', filters.chambre],
    queryFn: () =>
      api
        .get('/scrutins/periodes', { params: { chambre: filters.chambre || undefined } })
        .then((res) => res.data),
  });

  const periodPresets = useMemo(
    () => toPeriodePresets(periodesData?.data ?? []),
    [periodesData]
  );

  // Fetch trending dossiers
  const { data: trendingData } = useQuery<{ data: TrendingDossier[] }>({
    queryKey: ['dossiers-trending'],
    queryFn: () => api.get('/dossiers/trending', { params: { limit: 6 } }).then((res) => res.data),
  });

  // Hook pour le scroll infini
  const { loadMoreRef } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  // Flatten all pages data
  const scrutins = data?.pages.flatMap((page) => page.data) ?? [];
  const total = data?.pages[0]?.meta.total ?? 0;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.chambre) count++;
    if (filters.type) count++;
    if (filters.tag) count++;
    if (dateRange.from || dateRange.to) count++;
    return count;
  }, [filters.chambre, filters.type, filters.tag, dateRange.from, dateRange.to]);

  const handleClearFilters = () => {
    clearAll(['dateFrom', 'dateTo']);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Scrutins</h1>
        <p className="mt-2 text-muted-foreground">
          {total > 0 ? total.toLocaleString('fr-FR') : '—'} votes publics de l&apos;Assemblée nationale et du Sénat
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Sources : <a href="https://data.assemblee-nationale.fr" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">data.assemblee-nationale.fr</a>, <a href="https://data.senat.fr" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">data.senat.fr</a>
          {' · '}<Link href="/comprendre/scrutin" className="underline hover:text-foreground">Qu&apos;est-ce qu&apos;un scrutin ?</Link>
          {' · '}<Link href="/guide/decrypter-un-scrutin" className="underline hover:text-foreground">Guide</Link>
          {/* Archives par année/mois : seule porte d'entrée vers /votes, qui n'avait
              aucun lien interne entrant (page orpheline malgré le sitemap). */}
          {' · '}<Link href="/votes" className="underline hover:text-foreground">Archives par année</Link>
        </p>
      </div>

      {/* Dossiers en cours */}
      {trendingData?.data && trendingData.data.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Dossiers en cours</h2>
            <Link
              href="/dossiers"
              className="flex items-center text-sm font-medium text-primary hover:underline"
            >
              Voir tous les dossiers
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
            {trendingData.data.map((d) => (
              <Link
                key={d.id}
                href={`/dossiers/${d.uid}`}
                className="min-w-[260px] max-w-[300px] flex-shrink-0 rounded-lg border bg-card p-3 transition-all hover:border-primary hover:shadow-md"
              >
                <div className="flex items-center gap-2 mb-2">
                  {d.etat && (
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${etatLabels[d.etat]?.color || 'bg-muted text-muted-foreground'}`}>
                      {etatLabels[d.etat]?.label || d.etat}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                    <Vote className="h-3 w-3" />
                    {d._count.scrutins}
                  </span>
                </div>
                <h3 className="font-medium text-sm leading-tight line-clamp-2">
                  {formatDossierTitre(d.titre, d.procedureLibelle)}
                </h3>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <FilterBar
        activeFilterCount={activeFilterCount}
        onClear={handleClearFilters}
        search={
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher un scrutin..."
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

        {/* Filtre par type */}
        <div className="relative md:w-auto">
          <select
            value={filters.type}
            onChange={(e) => setFilter('type', e.target.value)}
            className="w-full appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tous les types</option>
            <option value="solennel">Solennel</option>
            <option value="ordinaire">Ordinaire</option>
            <option value="motion">Motion</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Filtre par tag */}
        <div className="relative md:w-auto">
          <select
            value={filters.tag}
            onChange={(e) => setFilter('tag', e.target.value)}
            className="w-full appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Toutes les thématiques</option>
            {tagsData?.map((t: { name: string; count: number }) => (
              <option key={t.name} value={t.name}>
                {capitalize(t.name)} ({t.count})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Filtre par période */}
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          placeholder="Période"
          periodPresets={periodPresets}
          onPeriodSelect={(periode) =>
            // Une seule écriture d'URL : la plage de dates ET la chambre, qu'une
            // législature (Assemblée) ou une session (Sénat) implique forcément.
            setFilters({
              chambre: periode.chambre,
              ...dateRangeToParams({ from: periode.from, to: periode.to }),
            })
          }
          resultCount={total}
        />
      </FilterBar>

      {/* Loading initial */}
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
          Une erreur est survenue lors du chargement des scrutins.
        </div>
      )}

      {/* Liste des scrutins */}
      {scrutins.length > 0 && (
        <>
          <div className="space-y-4">
            {scrutins.map((scrutin) => (
              <ScrutinListCard key={scrutin.id} scrutin={scrutin} />
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
            {!hasNextPage && scrutins.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Tous les scrutins ont été chargés
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function PageClient() {
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
      <ScrutinsPageContent />
    </Suspense>
  );
}
