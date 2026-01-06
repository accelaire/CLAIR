'use client';

import { Suspense } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Search, ChevronDown, CheckCircle, XCircle, Calendar, Tag, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { DateRangePicker, dateRangeToParams } from '@/components/DateRangePicker';
import { useUrlFilters, useUrlDateRange } from '@/hooks/useUrlFilters';

interface Scrutin {
  id: string;
  numero: number;
  chambre: string;
  session: string;
  date: string;
  titre: string;
  sort: string;
  typeVote: string;
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
  nombreVotants: number;
  importance: number;
  tags: string[];
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

const sortLabels: Record<string, { label: string; color: string }> = {
  adopte: { label: 'Adopté', color: 'text-green-600 bg-green-100' },
  rejete: { label: 'Rejeté', color: 'text-red-600 bg-red-100' },
};

const typeLabels: Record<string, string> = {
  solennel: 'Solennel',
  ordinaire: 'Ordinaire',
  motion: 'Motion',
};

const chambreLabels: Record<string, string> = {
  assemblee: 'Assemblée nationale',
  senat: 'Sénat',
};

// Formater la session pour l'affichage
const formatSession = (chambre: string, session: string): string | null => {
  if (chambre === 'senat') {
    // Pour le Sénat: "2024" -> "Session 2024-2025"
    const year = parseInt(session, 10);
    if (!isNaN(year)) {
      return `${year}-${year + 1}`;
    }
    return session;
  }
  // Pour l'AN, on n'affiche pas la législature (c'est toujours la même)
  return null;
};

function ScrutinsPageContent() {
  // Sync filters with URL for back button preservation
  const [filters, setFilter] = useUrlFilters<{
    search: string;
    chambre: string;
    type: string;
    tag: string;
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

  // Hook pour le scroll infini
  const { loadMoreRef } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  // Flatten all pages data
  const scrutins = data?.pages.flatMap((page) => page.data) ?? [];
  const total = data?.pages[0]?.meta.total ?? 0;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Scrutins</h1>
        <p className="mt-2 text-muted-foreground">
          Tous les votes publics de l&apos;Assemblée nationale et du Sénat
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Sources : <a href="https://data.assemblee-nationale.fr" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">data.assemblee-nationale.fr</a>, <a href="https://data.senat.fr" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">data.senat.fr</a>
        </p>
      </div>

      {/* Filtres */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start">
        {/* Recherche */}
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

        {/* Filtre par chambre */}
        <div className="relative w-full sm:w-auto">
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
        <div className="relative w-full sm:w-auto">
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
        <div className="relative w-full sm:w-auto">
          <select
            value={filters.tag}
            onChange={(e) => setFilter('tag', e.target.value)}
            className="w-full appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Toutes les thématiques</option>
            {tagsData?.map((t: { name: string; count: number }) => (
              <option key={t.name} value={t.name}>
                {t.name} ({t.count})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Filtre par période */}
        <div className="w-full sm:w-auto">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder="Période"
          />
        </div>
      </div>

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
          <div className="mb-4 text-sm text-muted-foreground">
            {total} scrutin{total > 1 ? 's' : ''}
          </div>

          <div className="space-y-4">
            {scrutins.map((scrutin) => (
              <Link
                key={scrutin.id}
                href={`/scrutins/${scrutin.numero}?chambre=${scrutin.chambre || 'assemblee'}${scrutin.chambre === 'senat' && scrutin.session ? `&session=${scrutin.session}` : ''}`}
                className="block rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  {/* Infos principales */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium text-muted-foreground">
                        Scrutin n°{scrutin.numero}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${scrutin.chambre === 'senat' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {chambreLabels[scrutin.chambre] || 'Assemblée nationale'}
                      </span>
                      {scrutin.chambre === 'senat' && scrutin.session && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                          {formatSession(scrutin.chambre, scrutin.session)}
                        </span>
                      )}
                      {scrutin.importance >= 4 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                          Important
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-lg leading-tight mb-2 line-clamp-2">
                      {scrutin.titre}
                    </h3>

                    {/* Meta infos */}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(scrutin.date)}
                      </span>
                      <span className="px-2 py-0.5 bg-muted rounded text-xs">
                        {typeLabels[scrutin.typeVote] || scrutin.typeVote}
                      </span>
                      {scrutin.tags && scrutin.tags.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {scrutin.tags[0]}
                          {scrutin.tags.length > 1 && ` +${scrutin.tags.length - 1}`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Résultat */}
                  <div className="flex items-center gap-4">
                    {/* Votes */}
                    <div className="flex items-center gap-3 text-sm">
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        {scrutin.nombrePour}
                      </span>
                      <span className="flex items-center gap-1 text-red-600">
                        <XCircle className="h-4 w-4" />
                        {scrutin.nombreContre}
                      </span>
                      <span className="text-muted-foreground">
                        {scrutin.nombreAbstention} abs.
                      </span>
                    </div>

                    {/* Badge résultat */}
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${sortLabels[scrutin.sort]?.color || 'bg-muted text-muted-foreground'}`}>
                      {sortLabels[scrutin.sort]?.label || scrutin.sort}
                    </span>
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

export default function ScrutinsPage() {
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
