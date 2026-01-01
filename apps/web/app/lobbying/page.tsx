'use client';

import { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Search, ChevronDown, Building2, Briefcase, TrendingUp, Users, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

interface Lobbyiste {
  id: string;
  siren: string | null;
  nom: string;
  type: string | null;
  secteur: string | null;
  budgetAnnuel: number | null;
  nbLobbyistes: number | null;
  actionsCount: number;
}

interface LobbyistesResponse {
  data: Lobbyiste[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
  };
}

const typeLabels: Record<string, { label: string; icon: typeof Building2 }> = {
  entreprise: { label: 'Entreprise', icon: Building2 },
  association: { label: 'Association', icon: Users },
  cabinet: { label: 'Cabinet de conseil', icon: Briefcase },
  syndicat: { label: 'Syndicat', icon: Users },
  organisation_pro: { label: 'Organisation professionnelle', icon: Briefcase },
};

const formatBudget = (budget: number | null): string => {
  if (!budget) return '-';
  if (budget >= 1000000) return `${(budget / 1000000).toFixed(1)}M€`;
  if (budget >= 1000) return `${(budget / 1000).toFixed(0)}k€`;
  return `${budget}€`;
};

export default function LobbyingPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [secteur, setSecteur] = useState('');
  const [sort, setSort] = useState<'nom' | 'budget' | 'actions'>('nom');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  // Fetch lobbyistes avec infinite scroll
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<LobbyistesResponse>({
    queryKey: ['lobbyistes', { search, type, secteur, sort, order }],
    queryFn: ({ pageParam = 1 }) =>
      api.get('/lobbying', {
        params: {
          search: search || undefined,
          type: type || undefined,
          secteur: secteur || undefined,
          page: pageParam,
          limit: 20,
          sort,
          order,
        },
      }).then((res) => res.data),
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
  });

  // Fetch secteurs
  const { data: secteursData } = useQuery({
    queryKey: ['lobbying-secteurs'],
    queryFn: () => api.get('/lobbying/secteurs').then((res) => res.data.data),
  });

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['lobbying-stats'],
    queryFn: () => api.get('/lobbying/stats').then((res) => res.data.data),
  });

  // Hook pour le scroll infini
  const { loadMoreRef } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  // Flatten all pages data
  const lobbyistes = data?.pages.flatMap((page) => page.data) ?? [];
  const total = data?.pages[0]?.meta.total ?? 0;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Lobbying</h1>
        <p className="mt-2 text-muted-foreground">
          Représentants d&apos;intérêts enregistrés auprès de la HATVP
        </p>
      </div>

      {/* Stats cards */}
      {statsData && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Building2 className="h-4 w-4" />
              <span className="text-sm">Lobbyistes</span>
            </div>
            <p className="text-2xl font-bold">{statsData.totalLobbyistes}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Briefcase className="h-4 w-4" />
              <span className="text-sm">Actions déclarées</span>
            </div>
            <p className="text-2xl font-bold">{statsData.totalActions}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Budget total déclaré</span>
            </div>
            <p className="text-2xl font-bold">{formatBudget(statsData.budgetTotal)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Secteurs d&apos;activité</span>
            </div>
            <p className="text-2xl font-bold">{statsData.topSecteurs?.length || 0}</p>
          </div>
        </div>
      )}

      {/* Filtres - Tout sur une seule ligne */}
      <div className="mb-8 flex items-center gap-3">
        {/* Recherche */}
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher un lobbyiste..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-background pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Filtre par type */}
        <div className="relative">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tous les types</option>
            {Object.entries(typeLabels).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Filtre par secteur */}
        <div className="relative flex-1">
          <select
            value={secteur}
            onChange={(e) => setSecteur(e.target.value)}
            className="w-full appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tous les secteurs</option>
            {secteursData?.slice(0, 20).map((s: { name: string; count: number }) => (
              <option key={s.name} value={s.name}>
                {s.name} ({s.count})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Tri */}
        <div className="flex items-center gap-0">
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => {
                const newSort = e.target.value as 'nom' | 'budget' | 'actions';
                setSort(newSort);
                // Auto-set order: asc for nom, desc for budget/actions
                setOrder(newSort === 'nom' ? 'asc' : 'desc');
              }}
              className="appearance-none rounded-lg rounded-r-none border border-r-0 bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="nom">Tri: Nom</option>
              <option value="budget">Tri: Budget</option>
              <option value="actions">Tri: Actions</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
          <button
            onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}
            className="flex items-center justify-center rounded-lg rounded-l-none border bg-background px-3 py-2 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            title={order === 'asc' ? 'Croissant' : 'Décroissant'}
          >
            {order === 'asc' ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Loading initial */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
              <div className="h-5 w-1/2 rounded bg-muted mb-2" />
              <div className="h-4 w-1/3 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Une erreur est survenue lors du chargement des lobbyistes.
        </div>
      )}

      {/* Liste */}
      {lobbyistes.length > 0 && (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            {total} représentant{total > 1 ? 's' : ''} d&apos;intérêts
          </div>

          <div className="space-y-3">
            {lobbyistes.map((lobbyiste) => {
              const typeConfig = typeLabels[lobbyiste.type || ''];
              const Icon = typeConfig?.icon || Building2;

              return (
                <Link
                  key={lobbyiste.id}
                  href={`/lobbying/${lobbyiste.id}`}
                  className="block rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {/* Infos principales */}
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{lobbyiste.nom}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                          {typeConfig && (
                            <span className="px-2 py-0.5 bg-muted rounded text-xs">
                              {typeConfig.label}
                            </span>
                          )}
                          {lobbyiste.secteur && (
                            <span>{lobbyiste.secteur}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm">
                      {lobbyiste.budgetAnnuel && (
                        <div className="text-center">
                          <p className="font-semibold text-primary">{formatBudget(lobbyiste.budgetAnnuel)}</p>
                          <p className="text-xs text-muted-foreground">Budget</p>
                        </div>
                      )}
                      <div className="text-center">
                        <p className="font-semibold">{lobbyiste.actionsCount}</p>
                        <p className="text-xs text-muted-foreground">Actions</p>
                      </div>
                      {lobbyiste.nbLobbyistes && lobbyiste.nbLobbyistes > 0 && (
                        <div className="text-center">
                          <p className="font-semibold">{lobbyiste.nbLobbyistes}</p>
                          <p className="text-xs text-muted-foreground">Lobbyistes</p>
                        </div>
                      )}
                    </div>
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
            {!hasNextPage && lobbyistes.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Tous les lobbyistes ont été chargés
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
