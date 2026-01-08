'use client';

import { Suspense } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Search, ChevronDown, Building2, Briefcase, TrendingUp, Users, ArrowUp, ArrowDown, Loader2, Calendar, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useUrlFilters } from '@/hooks/useUrlFilters';

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

interface ActionRecente {
  id: string;
  description: string;
  cible: string | null;
  cibleNom: string | null;
  dateDebut: string | null;
  texteVise: string | null;
  texteViseNom: string | null;
  lobbyiste: {
    id: string;
    nom: string;
    type: string | null;
    secteur: string | null;
  };
  parlementaire: {
    id: string;
    slug: string;
    nom: string;
    prenom: string;
    groupe: { nom: string; couleur: string | null } | null;
  } | null;
}

const typeLabels: Record<string, { label: string; icon: typeof Building2 }> = {
  entreprise: { label: 'Entreprise', icon: Building2 },
  association: { label: 'Association', icon: Users },
  cabinet: { label: 'Cabinet de conseil', icon: Briefcase },
  syndicat: { label: 'Syndicat', icon: Users },
  organisation_pro: { label: 'Organisation professionnelle', icon: Briefcase },
};

const cibleLabels: Record<string, string> = {
  parlementaire: 'Parlement',
  depute: 'Parlement',
  ministre: 'Gouvernement',
  presidence: 'Présidence',
  collectivite: 'Collectivités',
  autorite: 'AAI/API',
  administration: 'Administration',
};

const formatDate = (date: string | null): string => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatBudget = (budget: number | null): string => {
  if (!budget) return '-';
  if (budget >= 1000000) return `${(budget / 1000000).toFixed(1)}M€`;
  if (budget >= 1000) return `${(budget / 1000).toFixed(0)}k€`;
  return `${budget}€`;
};

function LobbyingPageContent() {
  // Sync filters with URL for back button preservation
  const [filters, setFilter, setFilters] = useUrlFilters<{
    search: string;
    type: string;
    secteur: string;
    sort: string;
    order: string;
  }>(['search', 'type', 'secteur', 'sort', 'order'], {
    defaults: { sort: 'nom', order: 'asc' },
  });

  const sort = (filters.sort || 'nom') as 'nom' | 'budget' | 'actions';
  const order = (filters.order || 'asc') as 'asc' | 'desc';

  // Fetch lobbyistes avec infinite scroll
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<LobbyistesResponse>({
    queryKey: ['lobbyistes', { ...filters }],
    queryFn: ({ pageParam = 1 }) =>
      api.get('/lobbying', {
        params: {
          search: filters.search || undefined,
          type: filters.type || undefined,
          secteur: filters.secteur || undefined,
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

  // Fetch 3 dernières actions de lobbying
  const { data: actionsRecentes } = useQuery<ActionRecente[]>({
    queryKey: ['lobbying-actions-recentes'],
    queryFn: () => api.get('/lobbying/actions/recent', { params: { limit: 3 } }).then((res) => res.data.data),
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

      {/* Dernières actions de lobbying */}
      {actionsRecentes && actionsRecentes.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Dernières actions déclarées
            </h2>
            <Link
              href="/lobbying/actions"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Voir toutes les actions
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {actionsRecentes.map((action) => {
              const typeConfig = typeLabels[action.lobbyiste.type || ''];
              const Icon = typeConfig?.icon || Building2;

              return (
                <Link
                  key={action.id}
                  href={`/lobbying/${action.lobbyiste.id}`}
                  className="group rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md flex flex-col"
                >
                  {/* Description de l'action */}
                  <p className="font-medium line-clamp-2 mb-3 flex-1">
                    {action.description || 'Objet non précisé'}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {action.cible && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded text-xs">
                        {cibleLabels[action.cible] || action.cible}
                      </span>
                    )}
                    {action.texteViseNom && (
                      <span
                        className="px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded text-xs truncate max-w-[150px]"
                        title={action.texteViseNom}
                      >
                        {action.texteViseNom.length > 30
                          ? action.texteViseNom.substring(0, 30) + '...'
                          : action.texteViseNom}
                      </span>
                    )}
                    {action.dateDebut && (
                      <span className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Calendar className="h-3 w-3" />
                        {formatDate(action.dateDebut)}
                      </span>
                    )}
                  </div>

                  {/* Parlementaire ciblé */}
                  {action.parlementaire && (
                    <div className="mb-3 flex items-center gap-1.5 text-xs">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: action.parlementaire.groupe?.couleur || '#888' }}
                      />
                      <span className="font-medium">{action.parlementaire.prenom} {action.parlementaire.nom}</span>
                      {action.parlementaire.groupe && (
                        <span className="text-muted-foreground truncate">
                          ({action.parlementaire.groupe.nom})
                        </span>
                      )}
                    </div>
                  )}

                  {/* Lobbyiste (acteur) */}
                  <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 rounded bg-muted shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{action.lobbyiste.nom}</p>
                        {action.lobbyiste.secteur && (
                          <p className="text-xs text-muted-foreground truncate">{action.lobbyiste.secteur}</p>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-2" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

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

      {/* Titre section Représentants d'intérêts */}
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Building2 className="h-5 w-5 text-primary" />
        Représentants d&apos;intérêts
      </h2>

      {/* Filtres - Responsive */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
        {/* Recherche */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher un lobbyiste..."
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            className="w-full rounded-lg border bg-background pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Filtre par type */}
        <div className="relative w-full sm:w-auto">
          <select
            value={filters.type}
            onChange={(e) => setFilter('type', e.target.value)}
            className="w-full appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tous les types</option>
            {Object.entries(typeLabels).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Filtre par secteur */}
        <div className="relative w-full sm:w-auto sm:min-w-[200px] sm:flex-1 sm:max-w-[300px]">
          <select
            value={filters.secteur}
            onChange={(e) => setFilter('secteur', e.target.value)}
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
        <div className="flex items-center gap-0 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <select
              value={sort}
              onChange={(e) => {
                const newSort = e.target.value as 'nom' | 'budget' | 'actions';
                // Use batch update to set both sort and order at once
                setFilters({
                  sort: newSort,
                  order: newSort === 'nom' ? 'asc' : 'desc',
                });
              }}
              className="w-full appearance-none rounded-lg rounded-r-none border border-r-0 bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="nom">Tri: Nom</option>
              <option value="budget">Tri: Budget</option>
              <option value="actions">Tri: Actions</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
          <button
            onClick={() => setFilter('order', order === 'asc' ? 'desc' : 'asc')}
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

export default function LobbyingPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
              <div className="h-5 w-1/2 rounded bg-muted mb-2" />
              <div className="h-4 w-1/3 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    }>
      <LobbyingPageContent />
    </Suspense>
  );
}
