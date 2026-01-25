'use client';

import { Suspense } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Search, ChevronDown, Calendar, Hash, Loader2, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useUrlFilters } from '@/hooks/useUrlFilters';

interface Sujet {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  category: string | null;
  memberCount: number;
  dateDebut: string | null;
  dateFin: string | null;
  featured: boolean;
  newsUrl: string | null;
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

interface Category {
  name: string;
  count: number;
}

const categoryLabels: Record<string, { label: string; color: string }> = {
  budget: { label: 'Budget', color: 'bg-emerald-100 text-emerald-700' },
  sante: { label: 'Santé', color: 'bg-red-100 text-red-700' },
  securite: { label: 'Sécurité', color: 'bg-orange-100 text-orange-700' },
  immigration: { label: 'Immigration', color: 'bg-amber-100 text-amber-700' },
  environnement: { label: 'Environnement', color: 'bg-green-100 text-green-700' },
  travail: { label: 'Travail', color: 'bg-blue-100 text-blue-700' },
  education: { label: 'Éducation', color: 'bg-purple-100 text-purple-700' },
  justice: { label: 'Justice', color: 'bg-slate-100 text-slate-700' },
  institutions: { label: 'Institutions', color: 'bg-indigo-100 text-indigo-700' },
  europe: { label: 'Europe', color: 'bg-blue-100 text-blue-700' },
  international: { label: 'International', color: 'bg-cyan-100 text-cyan-700' },
  agriculture: { label: 'Agriculture', color: 'bg-lime-100 text-lime-700' },
  logement: { label: 'Logement', color: 'bg-yellow-100 text-yellow-700' },
  transports: { label: 'Transports', color: 'bg-teal-100 text-teal-700' },
  culture: { label: 'Culture', color: 'bg-pink-100 text-pink-700' },
  autre: { label: 'Autre', color: 'bg-gray-100 text-gray-700' },
};

function SujetsPageContent() {
  // Sync filters with URL
  const [filters, setFilter] = useUrlFilters<{
    search: string;
    category: string;
  }>(['search', 'category']);

  // Fetch sujets avec infinite scroll
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<SujetsResponse>({
    queryKey: ['sujets', filters],
    queryFn: ({ pageParam = 1 }) =>
      api.get('/sujets', {
        params: {
          search: filters.search || undefined,
          category: filters.category || undefined,
          page: pageParam,
          limit: 20,
        },
      }).then((res) => res.data),
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['sujets-categories'],
    queryFn: () => api.get('/sujets/categories').then((res) => res.data.data),
  });

  // Hook pour le scroll infini
  const { loadMoreRef } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  // Flatten all pages data
  const sujets = data?.pages.flatMap((page) => page.data) ?? [];
  const total = data?.pages[0]?.meta.total ?? 0;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Sujets</h1>
        <p className="mt-2 text-muted-foreground">
          Thématiques regroupant les scrutins parlementaires par sujets
        </p>
      </div>

      {/* Filtres */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start">
        {/* Recherche */}
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

        {/* Filtre par catégorie */}
        <div className="relative w-full sm:w-auto">
          <select
            value={filters.category}
            onChange={(e) => setFilter('category', e.target.value)}
            className="w-full appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Toutes les catégories</option>
            {categoriesData?.map((c: Category) => (
              <option key={c.name} value={c.name}>
                {categoryLabels[c.name]?.label || c.name} ({c.count})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Loading initial */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
              <div className="h-5 w-3/4 rounded bg-muted mb-2" />
              <div className="h-4 w-full rounded bg-muted mb-2" />
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

      {/* Liste des sujets */}
      {sujets.length > 0 && (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            {total.toLocaleString('fr-FR')} sujet{total > 1 ? 's' : ''}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sujets.map((sujet) => (
              <Link
                key={sujet.id}
                href={`/sujets/${sujet.slug}`}
                className="block rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
              >
                {/* Featured badge */}
                {sujet.featured && (
                  <div className="flex items-center gap-1 text-amber-600 text-xs font-medium mb-2">
                    <TrendingUp className="h-3 w-3" />
                    <span>À la une</span>
                  </div>
                )}

                {/* Category badge */}
                {sujet.category && (
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded mb-2 ${categoryLabels[sujet.category]?.color || 'bg-gray-100 text-gray-700'}`}>
                    {categoryLabels[sujet.category]?.label || sujet.category}
                  </span>
                )}

                {/* Titre */}
                <h3 className="font-semibold text-lg leading-tight mb-2 line-clamp-2">
                  {sujet.label}
                </h3>

                {/* Description */}
                {sujet.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {sujet.description}
                  </p>
                )}

                {/* Meta infos */}
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Hash className="h-4 w-4" />
                    {sujet.memberCount} scrutin{sujet.memberCount > 1 ? 's' : ''}
                  </span>
                  {sujet.dateDebut && sujet.dateFin && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(sujet.dateDebut)} - {formatDate(sujet.dateFin)}
                    </span>
                  )}
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
                Tous les sujets ont été chargés
              </p>
            )}
          </div>
        </>
      )}

      {/* Empty state */}
      {!isLoading && sujets.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Aucun sujet trouvé pour ces critères
          </p>
        </div>
      )}
    </div>
  );
}

export default function SujetsPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
              <div className="h-5 w-3/4 rounded bg-muted mb-2" />
              <div className="h-4 w-full rounded bg-muted mb-2" />
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
