'use client';

import { Suspense, useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Search, ChevronDown, Building2, Briefcase, TrendingUp, Users, Loader2, Calendar, ArrowRight } from 'lucide-react';
import { DidacticielTooltip } from '@/components/ui/didacticiel-tooltip';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { LobbyisteLogo } from '@/components/lobbying';
import { FilterBar } from '@/components/FilterBar';
import { MultiSelectFilter } from '@/components/MultiSelectFilter';

interface SecteurRef {
  slug: string;
  label: string;
}

interface Lobbyiste {
  id: string;
  siren: string | null;
  nom: string;
  type: string | null;
  secteur: string | null;
  siteWeb: string | null;
  budgetAnnuel: number | null;
  nbLobbyistes: number | null;
  actionsCount: number;
  secteursList?: SecteurRef[];
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
  secteursList?: SecteurRef[];
  lobbyiste: {
    id: string;
    nom: string;
    type: string | null;
    secteur: string | null;
    siteWeb: string | null;
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

// Extraire le secteur entre crochets de la description
const extractSecteur = (description: string): { secteur: string | null; cleanDescription: string } => {
  const match = description.match(/^\[([^\]]+)\]\s*/);
  if (match) {
    return {
      secteur: match[1],
      cleanDescription: description.replace(match[0], ''),
    };
  }
  return { secteur: null, cleanDescription: description };
};

// Couleurs pour les secteurs (basées sur un hash simple du nom)
const secteurColorClasses = [
  'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
];

const getSecteurColor = (secteur: string): string => {
  let hash = 0;
  for (let i = 0; i < secteur.length; i++) {
    hash = secteur.charCodeAt(i) + ((hash << 5) - hash);
  }
  return secteurColorClasses[Math.abs(hash) % secteurColorClasses.length];
};

function LobbyingPageContent() {
  // Sync filters with URL for back button preservation
  const [filters, setFilter, setFilters, clearAll] = useUrlFilters<{
    search: string;
    type: string;
    secteurs: string;
    sort: string;
    order: string;
  }>(['search', 'type', 'secteurs', 'sort', 'order'], {
    defaults: { sort: 'nom', order: 'asc' },
  });

  const sort = (filters.sort || 'nom') as 'nom' | 'budget' | 'actions';
  const order = (filters.order || 'asc') as 'asc' | 'desc';
  const selectedSecteurs = filters.secteurs ? filters.secteurs.split(',').filter(Boolean) : [];

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
          secteurs: filters.secteurs || undefined,
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

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.type) count++;
    if (filters.secteurs) count++;
    if (filters.sort && filters.sort !== 'nom') count++;
    if (filters.order && filters.order !== 'asc' && filters.sort === 'nom') count++;
    return count;
  }, [filters.type, filters.secteurs, filters.sort, filters.order]);

  const handleClearFilters = () => {
    clearAll();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Lobbying</h1>
        <p className="mt-2 text-muted-foreground">
          Représentants d&apos;intérêts enregistrés auprès de la HATVP
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Source : <a href="https://www.hatvp.fr/le-repertoire/" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">hatvp.fr</a>
          {' · '}<a href="/methodologie#hatvp" className="underline hover:text-foreground">Méthodologie</a>
          {' · '}<Link href="/comprendre/lobbying" className="underline hover:text-foreground">Comprendre le lobbying</Link>
          {' · '}<Link href="/guide/comprendre-le-lobbying" className="underline hover:text-foreground">Guide</Link>
        </p>
      </div>

      {/* Stats cards */}
      {statsData && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Building2 className="h-4 w-4" />
              <span className="text-sm">Lobbyistes</span>
              <DidacticielTooltip
                content="Représentants d'intérêts enregistrés auprès de la HATVP."
                learnMoreHref="/comprendre/lobbying"
              />
            </div>
            <p className="text-2xl font-bold">{statsData.totalLobbyistes.toLocaleString('fr-FR')}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Briefcase className="h-4 w-4" />
              <span className="text-sm">Actions déclarées</span>
              <DidacticielTooltip
                content="Chaque rencontre ou communication déclarée, comptée par exercice fiscal."
                learnMoreHref="/comprendre/lobbying"
              />
            </div>
            <p className="text-2xl font-bold">{statsData.totalActions.toLocaleString('fr-FR')}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Budget total déclaré</span>
              <DidacticielTooltip
                content="Somme des budgets annuels déclarés. Montants déclaratifs par tranches."
                learnMoreHref="/comprendre/lobbying"
              />
            </div>
            <p className="text-2xl font-bold">{formatBudget(statsData.budgetTotal)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Secteurs d&apos;activité</span>
              <DidacticielTooltip
                content="Secteurs distincts déclarés par les représentants d'intérêts."
                learnMoreHref="/comprendre/lobbying"
              />
            </div>
            <p className="text-2xl font-bold">{statsData.totalSecteurs?.toLocaleString('fr-FR') || 0}</p>
          </div>
        </div>
      )}

      {/* Dernières actions de lobbying */}
      {actionsRecentes && actionsRecentes.length > 0 && (
        <div className="mb-8 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
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
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {actionsRecentes.map((action) => {
              const typeConfig = typeLabels[action.lobbyiste.type || ''];
              const Icon = typeConfig?.icon || Building2;
              const { secteur, cleanDescription } = extractSecteur(action.description || '');

              return (
                <Link
                  key={action.id}
                  href={`/lobbying/${action.lobbyiste.id}`}
                  className="group rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md flex flex-col overflow-hidden"
                >
                  {/* Tags: Secteur + Cible type + Date */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {secteur && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSecteurColor(secteur)}`}>
                        {secteur}
                      </span>
                    )}
                    {action.cible && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded text-xs">
                        {cibleLabels[action.cible] || action.cible}
                      </span>
                    )}
                    {action.dateDebut && (
                      <span className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Calendar className="h-3 w-3" />
                        {formatDate(action.dateDebut)}
                      </span>
                    )}
                  </div>

                  {/* Description de l'action (nettoyée du secteur) */}
                  <p className="font-medium line-clamp-2 mb-3 flex-1">
                    {cleanDescription || 'Objet non précisé'}
                  </p>

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
                      <LobbyisteLogo siteWeb={action.lobbyiste.siteWeb} nom={action.lobbyiste.nom} size="sm" className="shrink-0" />
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

      {/* Titre section Représentants d'intérêts */}
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Building2 className="h-5 w-5 text-primary" />
        Représentants d&apos;intérêts
      </h2>

      {/* Filtres */}
      <FilterBar
        activeFilterCount={activeFilterCount}
        onClear={handleClearFilters}
        search={
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
        }
      >
        {/* Filtre par type */}
        <div className="relative md:w-auto">
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

        {/* Filtre par secteur (multi-select) */}
        <MultiSelectFilter
          options={(secteursData || [])
            .filter((s: { count: number }) => s.count > 0)
            .map((s: { slug: string; name: string; count: number }) => ({
              value: s.slug,
              label: s.name,
              count: s.count,
            }))}
          selected={selectedSecteurs}
          onChange={(sel) => setFilter('secteurs', sel.join(','))}
          placeholder="Tous les secteurs"
        />

        {/* Tri */}
        <div className="relative md:w-auto">
          <select
            value={`${sort}-${order}`}
            onChange={(e) => {
              const [newSort, newOrder] = e.target.value.split('-') as [
                'nom' | 'budget' | 'actions',
                'asc' | 'desc',
              ];
              setFilters({ sort: newSort, order: newOrder });
            }}
            className="w-full appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="nom-asc">Nom (A → Z)</option>
            <option value="nom-desc">Nom (Z → A)</option>
            <option value="budget-asc">Budget (croissant)</option>
            <option value="budget-desc">Budget (décroissant)</option>
            <option value="actions-asc">Nombre d&apos;actions (croissant)</option>
            <option value="actions-desc">Nombre d&apos;actions (décroissant)</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </FilterBar>

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
            {total.toLocaleString('fr-FR')} représentant{total > 1 ? 's' : ''} d&apos;intérêts
          </div>

          <div className="space-y-3">
            {lobbyistes.map((lobbyiste) => {
              const typeConfig = typeLabels[lobbyiste.type || ''];

              return (
                <Link
                  key={lobbyiste.id}
                  href={`/lobbying/${lobbyiste.id}`}
                  className="block rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    {/* Logo */}
                    <LobbyisteLogo siteWeb={lobbyiste.siteWeb} nom={lobbyiste.nom} size="md" />

                    {/* Infos principales */}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{lobbyiste.nom}</h3>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-sm text-muted-foreground">
                        {typeConfig && (
                          <span className="px-2 py-0.5 bg-muted rounded text-xs shrink-0">
                            {typeConfig.label}
                          </span>
                        )}
                        <span className="truncate">
                          {lobbyiste.secteursList && lobbyiste.secteursList.length > 0
                            ? lobbyiste.secteursList.map((s) => s.label).join(', ')
                            : lobbyiste.secteur || ''}
                        </span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-3 sm:gap-4 text-sm shrink-0">
                      <div className="text-center">
                        <p className={`font-semibold ${lobbyiste.budgetAnnuel ? 'text-primary' : 'text-muted-foreground'}`}>
                          {lobbyiste.budgetAnnuel ? formatBudget(lobbyiste.budgetAnnuel) : 'N.D.'}
                        </p>
                        <p className="text-xs text-muted-foreground">Budget</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold">{lobbyiste.actionsCount.toLocaleString('fr-FR')}</p>
                        <p className="text-xs text-muted-foreground">Actions</p>
                      </div>
                      {lobbyiste.nbLobbyistes && lobbyiste.nbLobbyistes > 0 && (
                        <div className="text-center hidden sm:block">
                          <p className="font-semibold">{lobbyiste.nbLobbyistes.toLocaleString('fr-FR')}</p>
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

export default function PageClient() {
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
