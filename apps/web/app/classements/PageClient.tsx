'use client';

import { Suspense, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  Search,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { getGroupColor } from '@/lib/colors';
import { ChambreToggle } from '@/components/classements/ChambreToggle';
import { SortSelect, PARLEMENTAIRE_SORT_OPTIONS } from '@/components/classements/SortSelect';
import { TopFlopCards } from '@/components/classements/TopFlopCards';
import { ClassementsTable } from '@/components/classements/ClassementsTable';

// =============================================================================
// Types
// =============================================================================

interface ParlementaireItem {
  slug: string;
  nom: string;
  prenom: string;
  photoUrl: string | null;
  chambre: 'assemblee' | 'senat';
  groupe: {
    slug: string;
    nom: string;
    couleur: string | null;
    position: string | null;
  } | null;
  stats: {
    presence: number;
    loyaute: number;
    participation: number;
    amendements: number;
    interventions: number;
  } | null;
}

interface ParlementairesResponse {
  data: ParlementaireItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface GroupeItem {
  id: string;
  slug: string;
  chambre: 'assemblee' | 'senat';
  nom: string;
  nomComplet: string | null;
  couleur: string | null;
  position: string | null;
  membresCount: number;
  membresActifsCount: number;
  statsPresenceMoyenne: number | null;
  statsPresenceSolennelMoyenne: number | null;
  statsLoyauteMoyenne: number | null;
  statsCohesion: number | null;
}

// =============================================================================
// Helpers
// =============================================================================

const CRITERION_CONFIG: Record<string, {
  label: string;
  getValue: (item: ParlementaireItem) => number | null;
  format: (v: number) => string;
}> = {
  presence: {
    label: 'Présence',
    getValue: (item) => item.stats?.presence ?? null,
    format: (v) => `${v}%`,
  },
  loyaute: {
    label: 'Loyauté',
    getValue: (item) => item.stats?.loyaute ?? null,
    format: (v) => `${v}%`,
  },
  amendements: {
    label: 'Amendements',
    getValue: (item) => item.stats?.amendements ?? null,
    format: (v) => v.toLocaleString('fr-FR'),
  },
  interventions: {
    label: 'Interventions',
    getValue: (item) => item.stats?.interventions ?? null,
    format: (v) => v.toLocaleString('fr-FR'),
  },
};

const GROUPE_SORT_OPTIONS = [
  { value: 'presence', label: 'Présence moyenne' },
  { value: 'loyaute', label: 'Loyauté moyenne' },
  { value: 'cohesion', label: 'Cohésion' },
  { value: 'membres', label: 'Nombre de membres' },
];

const PAGE_SIZE = 50;

// =============================================================================
// Parlementaires Tab
// =============================================================================

function ParlementairesTab() {
  const [filters, setFilter, setFilters] = useUrlFilters<{
    chambre: string;
    sort: string;
    order: string;
    groupe: string;
    page: string;
  }>(['chambre', 'sort', 'order', 'groupe', 'page'], {
    defaults: { sort: 'presence', order: 'desc', page: '1' },
  });

  const sort = filters.sort || 'presence';
  const order = filters.order || 'desc';
  const page = Math.max(1, parseInt(filters.page || '1', 10));

  // Fetch parlementaires
  const { data: parlementairesData, isLoading } = useQuery<ParlementairesResponse>({
    queryKey: ['classements-parlementaires', { chambre: filters.chambre, sort, order, groupe: filters.groupe, page }],
    queryFn: () =>
      api.get('/parlementaires', {
        params: {
          chambre: filters.chambre || undefined,
          sort,
          order,
          groupe: filters.groupe || undefined,
          page,
          limit: PAGE_SIZE,
        },
      }).then((res) => res.data),
  });

  // Top 5: derived from main query when page=1 + order=desc (no extra request)
  // Flop 5: separate request (ascending) — only fetched when visible
  const showTopFlop = page === 1 && !filters.groupe;

  const { data: flopData } = useQuery<ParlementairesResponse>({
    queryKey: ['classements-flop', { chambre: filters.chambre, sort }],
    queryFn: () =>
      api.get('/parlementaires', {
        params: {
          chambre: filters.chambre || undefined,
          sort,
          order: 'asc',
          page: 1,
          limit: 5,
        },
      }).then((res) => res.data),
    enabled: showTopFlop,
  });

  // Fetch groupes for filter
  const { data: groupesData } = useQuery<{ data: { slug: string; nom: string; membresCount: number }[] }>({
    queryKey: ['classements-groupes-filter', filters.chambre],
    queryFn: () => {
      const endpoint = filters.chambre
        ? `/${filters.chambre === 'assemblee' ? 'deputes' : 'senateurs'}/groupes`
        : '/parlementaires/groupes';
      return api.get(endpoint).then((res) => res.data);
    },
  });

  const criterion = CRITERION_CONFIG[sort] || CRITERION_CONFIG.presence;
  const totalPages = parlementairesData?.meta.totalPages ?? 1;

  const handleSort = (newSort: string, newOrder: string) => {
    setFilters({ sort: newSort, order: newOrder, page: '1' });
  };

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <ChambreToggle
          value={filters.chambre}
          onChange={(v) => setFilters({ chambre: v, page: '1' })}
        />
        <SortSelect
          value={sort}
          onChange={(v) => setFilters({ sort: v, order: 'desc', page: '1' })}
          options={PARLEMENTAIRE_SORT_OPTIONS}
        />
        <div className="relative sm:w-auto">
          <select
            value={filters.groupe}
            onChange={(e) => setFilters({ groupe: e.target.value, page: '1' })}
            className="w-full appearance-none rounded-lg border bg-background px-4 py-2 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Tous les groupes</option>
            {groupesData?.data?.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.nom} ({g.membresCount})
              </option>
            ))}
          </select>
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Top / Flop */}
      {showTopFlop && parlementairesData && order === 'desc' && flopData && (
        <TopFlopCards
          top={parlementairesData.data.slice(0, 5)}
          flop={[...flopData.data].reverse()}
          criterionLabel={criterion.label}
          getValue={criterion.getValue}
          formatValue={criterion.format}
        />
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Table */}
      {parlementairesData && !isLoading && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {parlementairesData.meta.total.toLocaleString('fr-FR')} parlementaires
            </p>
          </div>

          <ClassementsTable
            data={parlementairesData.data}
            sort={sort}
            order={order}
            onSort={handleSort}
            page={page}
            limit={PAGE_SIZE}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setFilter('page', String(page - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Précédent</span>
              </button>
              <span className="text-sm text-muted-foreground">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setFilter('page', String(page + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                <span className="hidden sm:inline">Suivant</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// =============================================================================
// Groupes Tab
// =============================================================================

function GroupesTab() {
  const [filters, setFilter, setFilters] = useUrlFilters<{
    chambre: string;
    groupeSort: string;
  }>(['chambre', 'groupeSort'], {
    defaults: { groupeSort: 'presence' },
  });

  const groupeSort = filters.groupeSort || 'presence';

  const { data: groupesResponse, isLoading } = useQuery<{ data: GroupeItem[] }>({
    queryKey: ['classements-groupes', filters.chambre],
    queryFn: () => {
      const params = filters.chambre ? `?chambre=${filters.chambre}` : '';
      return api.get(`/groupes${params}`).then((res) => res.data);
    },
  });

  const sortedGroupes = useMemo(() => {
    if (!groupesResponse?.data) return [];
    const groupes = [...groupesResponse.data].filter((g) => g.membresActifsCount > 0);

    return groupes.sort((a, b) => {
      switch (groupeSort) {
        case 'presence':
          return (b.statsPresenceMoyenne ?? 0) - (a.statsPresenceMoyenne ?? 0);
        case 'loyaute':
          return (b.statsLoyauteMoyenne ?? 0) - (a.statsLoyauteMoyenne ?? 0);
        case 'cohesion':
          return (b.statsCohesion ?? 0) - (a.statsCohesion ?? 0);
        case 'membres':
          return b.membresActifsCount - a.membresActifsCount;
        default:
          return 0;
      }
    });
  }, [groupesResponse, groupeSort]);

  const getStatValue = (g: GroupeItem): number | null => {
    switch (groupeSort) {
      case 'presence': return g.statsPresenceMoyenne;
      case 'loyaute': return g.statsLoyauteMoyenne;
      case 'cohesion': return g.statsCohesion;
      case 'membres': return g.membresActifsCount;
      default: return null;
    }
  };

  const formatStat = (val: number | null): string => {
    if (val === null) return '—';
    if (groupeSort === 'membres') return val.toLocaleString('fr-FR');
    return `${val}%`;
  };

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <ChambreToggle
          value={filters.chambre}
          onChange={(v) => setFilter('chambre', v)}
        />
        <SortSelect
          value={groupeSort}
          onChange={(v) => setFilter('groupeSort', v)}
          options={GROUPE_SORT_OPTIONS}
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && sortedGroupes.length > 0 && (
        <div className="space-y-3">
          {sortedGroupes.map((groupe, index) => {
            const color = getGroupColor(groupe.nom, groupe.couleur, groupe.position);
            const mainStat = getStatValue(groupe);
            const isPercent = groupeSort !== 'membres';

            return (
              <Link
                key={groupe.id}
                href={`/groupes/${groupe.chambre}/${groupe.slug}`}
                className="group flex items-center gap-4 rounded-lg border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30"
              >
                {/* Rank */}
                <span className="w-8 text-center text-lg font-bold text-muted-foreground tabular-nums">
                  {index + 1}
                </span>

                {/* Color bar */}
                <div className="h-10 w-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold group-hover:text-primary transition-colors truncate">
                    {groupe.nom}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {groupe.membresActifsCount} membres
                    </span>
                    <span className={`px-1.5 py-0.5 rounded ${groupe.chambre === 'assemblee' ? 'badge-assemblee' : 'badge-senat'}`}>
                      {groupe.chambre === 'assemblee' ? 'AN' : 'Sénat'}
                    </span>
                  </div>
                </div>

                {/* Stats bar */}
                <div className="hidden sm:flex items-center gap-6 shrink-0">
                  {groupe.statsPresenceMoyenne !== null && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Présence</p>
                      <p className="text-sm font-semibold">{groupe.statsPresenceMoyenne}%</p>
                    </div>
                  )}
                  {groupe.statsLoyauteMoyenne !== null && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Loyauté</p>
                      <p className="text-sm font-semibold">{groupe.statsLoyauteMoyenne}%</p>
                    </div>
                  )}
                  {groupe.statsCohesion !== null && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Cohésion</p>
                      <p className="text-sm font-semibold">{groupe.statsCohesion}%</p>
                    </div>
                  )}
                </div>

                {/* Main stat on mobile */}
                <div className="sm:hidden shrink-0 text-right">
                  <p className="text-lg font-bold">{formatStat(mainStat)}</p>
                  <p className="text-xs text-muted-foreground">
                    {GROUPE_SORT_OPTIONS.find((o) => o.value === groupeSort)?.label}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Page
// =============================================================================

const TABS = [
  { key: 'parlementaires', label: 'Parlementaires', icon: Users },
  { key: 'groupes', label: 'Groupes politiques', icon: BarChart3 },
] as const;

function ClassementsPageContent() {
  const [filters, setFilter] = useUrlFilters<{ tab: string }>(['tab'], {
    defaults: { tab: 'parlementaires' },
  });

  const activeTab = filters.tab || 'parlementaires';

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Classements parlementaires</h1>
        <p className="mt-2 text-muted-foreground">
          Comparez l&apos;activité des parlementaires et des groupes politiques
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Données mises à jour quotidiennement
          {' · '}
          <Link href="/comprendre/parlementaire" className="underline hover:text-foreground">
            Comprendre les indicateurs
          </Link>
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b">
        <div className="flex gap-0">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter('tab', key)}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'parlementaires' ? <ParlementairesTab /> : <GroupesTab />}
    </div>
  );
}

export default function PageClient() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <div className="h-8 w-64 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-96 animate-pulse rounded bg-muted" />
          </div>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      }
    >
      <ClassementsPageContent />
    </Suspense>
  );
}
