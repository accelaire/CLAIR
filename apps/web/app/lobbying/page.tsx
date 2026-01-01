'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Search, ChevronDown, Building2, Briefcase, TrendingUp, Users, ArrowUp, ArrowDown } from 'lucide-react';
import { api } from '@/lib/api';

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
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<'nom' | 'budget' | 'actions'>('nom');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  // Fetch lobbyistes
  const { data, isLoading, error } = useQuery<LobbyistesResponse>({
    queryKey: ['lobbyistes', { search, type, secteur, page, sort, order }],
    queryFn: () =>
      api.get('/lobbying', {
        params: {
          search: search || undefined,
          type: type || undefined,
          secteur: secteur || undefined,
          page,
          limit: 20,
          sort,
          order,
        },
      }).then((res) => res.data),
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

      {/* Filtres */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row flex-wrap">
        {/* Recherche */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher un lobbyiste..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border bg-background px-10 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Filtre par type */}
        <div className="relative">
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
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
        <div className="relative">
          <select
            value={secteur}
            onChange={(e) => {
              setSecteur(e.target.value);
              setPage(1);
            }}
            className="appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary min-w-[150px]"
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
        <div className="flex items-center gap-1">
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'nom' | 'budget' | 'actions')}
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

      {/* Loading */}
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
      {data && (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            {data.meta.total} représentant{data.meta.total > 1 ? 's' : ''} d&apos;intérêts
          </div>

          <div className="space-y-3">
            {data.data.map((lobbyiste) => {
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

          {/* Pagination */}
          {data.meta.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Précédent
              </button>
              <span className="px-4 py-2 text-sm text-muted-foreground">
                Page {page} sur {data.meta.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))}
                disabled={page === data.meta.totalPages}
                className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
