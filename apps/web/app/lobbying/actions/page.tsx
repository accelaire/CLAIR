'use client';

import { Suspense, useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { Search, ChevronDown, Building2, Briefcase, Users, Loader2, Calendar, ArrowLeft, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useUrlFilters, useUrlDateRange } from '@/hooks/useUrlFilters';
import { DateRangePicker } from '@/components/DateRangePicker';
import { LobbyisteLogo } from '@/components/lobbying';
import { FilterBar } from '@/components/FilterBar';

interface ActionLobby {
  id: string;
  description: string;
  cible: string | null;
  cibleNom: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  texteVise: string | null;
  texteViseNom: string | null;
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
    photoUrl: string | null;
    groupe: { nom: string; couleur: string | null } | null;
  } | null;
}

interface ActionsResponse {
  data: ActionLobby[];
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

function ActionsPageContent() {
  const [filters, setFilter, setFilters, clearAll] = useUrlFilters<{
    search: string;
    cible: string;
    secteur: string;
    sort: string;
    order: string;
  }>(['search', 'cible', 'secteur', 'sort', 'order'], {
    defaults: { sort: 'dateDebut', order: 'desc' },
  });

  const [dateRange, setDateRange] = useUrlDateRange();

  const sort = (filters.sort || 'dateDebut') as 'dateDebut' | 'lobbyiste';
  const order = (filters.order || 'desc') as 'asc' | 'desc';

  // Formater les dates pour l'API
  const dateFrom = dateRange.from?.toISOString().split('T')[0];
  const dateTo = dateRange.to?.toISOString().split('T')[0];

  // Fetch actions avec infinite scroll
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<ActionsResponse>({
    queryKey: ['lobbying-actions', { ...filters, dateFrom, dateTo }],
    queryFn: ({ pageParam = 1 }) =>
      api.get('/lobbying/actions', {
        params: {
          search: filters.search || undefined,
          cible: filters.cible || undefined,
          secteur: filters.secteur || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
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

  // Fetch secteurs pour le filtre
  const { data: secteursData } = useQuery({
    queryKey: ['lobbying-secteurs'],
    queryFn: () => api.get('/lobbying/secteurs').then((res) => res.data.data),
  });

  // Hook pour le scroll infini
  const { loadMoreRef } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  // Flatten all pages data
  const actions = data?.pages.flatMap((page) => page.data) ?? [];
  const total = data?.pages[0]?.meta.total ?? 0;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.cible) count++;
    if (filters.secteur) count++;
    if (dateRange.from || dateRange.to) count++;
    if (filters.sort && filters.sort !== 'dateDebut') count++;
    if (filters.order && filters.order !== 'desc' && filters.sort === 'dateDebut') count++;
    return count;
  }, [filters.cible, filters.secteur, filters.sort, filters.order, dateRange.from, dateRange.to]);

  const handleClearFilters = () => {
    clearAll(['dateFrom', 'dateTo']);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header avec retour */}
      <div className="mb-8">
        <Link
          href="/lobbying"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au lobbying
        </Link>
        <h1 className="text-3xl font-bold">Actions de lobbying</h1>
        <p className="mt-2 text-muted-foreground">
          Toutes les actions de lobbying déclarées auprès de la HATVP
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
              placeholder="Rechercher une action, un lobbyiste..."
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              className="w-full rounded-lg border bg-background pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        }
      >
        {/* Filtre par cible */}
        <div className="relative md:w-auto">
          <select
            value={filters.cible}
            onChange={(e) => setFilter('cible', e.target.value)}
            className="w-full appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Toutes les cibles</option>
            {Object.entries(cibleLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Filtre par secteur */}
        <div className="relative md:w-auto md:min-w-[200px] md:flex-1 md:max-w-[300px]">
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
        <div className="relative md:w-auto">
          <select
            value={`${sort}-${order}`}
            onChange={(e) => {
              const [newSort, newOrder] = e.target.value.split('-') as [
                'dateDebut' | 'lobbyiste',
                'asc' | 'desc',
              ];
              setFilters({ sort: newSort, order: newOrder });
            }}
            className="w-full appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="dateDebut-desc">Date (récentes en premier)</option>
            <option value="dateDebut-asc">Date (anciennes en premier)</option>
            <option value="lobbyiste-asc">Lobbyiste (A → Z)</option>
            <option value="lobbyiste-desc">Lobbyiste (Z → A)</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Filtre par période */}
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          placeholder="Filtrer par période"
        />
      </FilterBar>

      {/* Loading initial */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
              <div className="h-5 w-3/4 rounded bg-muted mb-2" />
              <div className="h-4 w-1/2 rounded bg-muted mb-2" />
              <div className="h-4 w-1/3 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Une erreur est survenue lors du chargement des actions.
        </div>
      )}

      {/* Liste */}
      {actions.length > 0 && (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            {total} action{total > 1 ? 's' : ''} de lobbying
          </div>

          <div className="space-y-3">
            {actions.map((action) => {
              const typeConfig = typeLabels[action.lobbyiste.type || ''];
              const Icon = typeConfig?.icon || Building2;
              const { secteur, cleanDescription } = extractSecteur(action.description || '');

              return (
                <Link
                  key={action.id}
                  href={`/lobbying/${action.lobbyiste.id}`}
                  className="group block rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    {/* Contenu principal */}
                    <div className="flex-1 min-w-0">
                      {/* Tags: Secteur + Cible type + Date */}
                      <div className="flex flex-wrap items-center gap-2 text-sm mb-3">
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

                      {/* Description (nettoyée du secteur) */}
                      <p className="font-medium mb-3">
                        {cleanDescription || 'Objet non précisé'}
                      </p>

                      {/* Texte visé */}
                      {action.texteViseNom && (
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Texte visé :</strong> {action.texteViseNom}
                        </p>
                      )}

                      {/* Cible détaillée */}
                      {action.cibleNom && (
                        <p className="text-sm text-muted-foreground mb-3">
                          <strong>Cible :</strong> {action.cibleNom}
                        </p>
                      )}

                      {/* Parlementaire ciblé */}
                      {action.parlementaire && (
                        <div className="inline-flex items-center gap-2 p-2 rounded bg-muted/50 w-fit">
                          <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                            {action.parlementaire.photoUrl ? (
                              <Image
                                src={action.parlementaire.photoUrl}
                                alt={`${action.parlementaire.prenom} ${action.parlementaire.nom}`}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <Users className="absolute inset-0 m-auto h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {action.parlementaire.prenom} {action.parlementaire.nom}
                            </p>
                            {action.parlementaire.groupe && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: action.parlementaire.groupe.couleur || '#888' }}
                                />
                                {action.parlementaire.groupe.nom}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Lobbyiste */}
                    <div className="flex items-center gap-3 sm:min-w-[250px] sm:max-w-[300px] pt-3 sm:pt-0 sm:pl-4 border-t sm:border-t-0 sm:border-l border-border">
                      <LobbyisteLogo siteWeb={action.lobbyiste.siteWeb} nom={action.lobbyiste.nom} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{action.lobbyiste.nom}</p>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          {typeConfig && (
                            <span className="text-xs text-muted-foreground">
                              {typeConfig.label}
                            </span>
                          )}
                          {typeConfig && action.lobbyiste.secteur && (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                          {action.lobbyiste.secteur && (
                            <span className="text-xs text-muted-foreground truncate">
                              {action.lobbyiste.secteur}
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
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
            {!hasNextPage && actions.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Toutes les actions ont été chargées
              </p>
            )}
          </div>
        </>
      )}

      {/* Empty state */}
      {!isLoading && !error && actions.length === 0 && (
        <div className="text-center py-12">
          <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Aucune action trouvée</p>
          {(filters.search || filters.cible || filters.secteur) && (
            <button
              onClick={() => setFilters({ search: '', cible: '', secteur: '' })}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Effacer les filtres
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ActionsPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
              <div className="h-5 w-3/4 rounded bg-muted mb-2" />
              <div className="h-4 w-1/2 rounded bg-muted mb-2" />
              <div className="h-4 w-1/3 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    }>
      <ActionsPageContent />
    </Suspense>
  );
}
