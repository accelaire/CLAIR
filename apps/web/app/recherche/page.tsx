'use client';

import { useState, useEffect } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search, Users, Vote, Building2, FileText, Loader2, X,
  Landmark, BookOpen, Tag, ChevronRight, History,
} from 'lucide-react';
import { api } from '@/lib/api';
import { scrutinHref } from '@/lib/scrutin-url';
import { getDossierEtat } from '@/lib/dossiers';
import { useDebouncedCallback } from 'use-debounce';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { legislatureLabel } from '@/lib/periodes';

// =============================================================================
// Types
// =============================================================================

interface SearchResult {
  _type: 'depute' | 'senateur' | 'scrutin' | 'lobbyiste' | 'dossier' | 'groupe' | 'commission' | 'sujet';
  id?: string;
  slug?: string;
  nom?: string;
  chambre?: 'assemblee' | 'senat';
  prenom?: string;
  nomComplet?: string;
  photoUrl?: string;
  groupe?: string;
  groupeCouleur?: string;
  circonscription?: string;
  departement?: string;
  numero?: number;
  date?: string;
  titre?: string;
  sort?: string;
  typeVote?: string;
  importance?: number;
  session?: string;
  type?: string;
  secteur?: string;
  uid?: string;
  etat?: string;
  procedureLibelle?: string;
  loiNumero?: string;
  couleur?: string;
  actif?: boolean;
  statsMembresActifs?: number;
  nomCourt?: string;
  label?: string;
  description?: string;
  category?: string;
  status?: string;
  dossierCount?: number;
  scrutinCount?: number;
  // Parlementaires : mandat clos + contexte du dernier mandat (groupe d'époque).
  ancien?: boolean;
  sexe?: string | null;
  dernierMandat?: {
    chambre?: string;
    legislature?: number | null;
    mandature?: number | null;
    dateDebut?: string;
    dateFin?: string | null;
  } | null;
}

interface SearchCounts {
  deputes: number;
  senateurs: number;
  scrutins: number;
  lobbyistes: number;
  dossiers: number;
  groupes: number;
  commissions: number;
  sujets: number;
  total: number;
}

interface AllSearchResponse {
  sections: Record<string, SearchResult[]>;
  meta: {
    query: string;
    counts: SearchCounts;
    inclureAnciens?: boolean;
    anciensDisponibles?: number;
  };
}

interface FilteredSearchResponse {
  data: SearchResult[];
  meta: {
    query: string;
    counts: SearchCounts;
    inclureAnciens?: boolean;
    anciensDisponibles?: number;
    hasNext?: boolean;
    page?: number;
    total?: number;
  };
}

type FilterType = 'all' | 'deputes' | 'senateurs' | 'scrutins' | 'lobbyistes' | 'dossiers' | 'groupes' | 'commissions' | 'sujets';

const PAGE_SIZE = 30;

// =============================================================================
// Config
// =============================================================================

const typeConfig: Record<string, { label: string; labelPlural: string; icon: typeof Users; color: string; filterKey: FilterType }> = {
  depute:     { label: 'Député',      labelPlural: 'Députés',      icon: Users,    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',       filterKey: 'deputes' },
  senateur:   { label: 'Sénateur',    labelPlural: 'Sénateurs',    icon: Users,    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',     filterKey: 'senateurs' },
  scrutin:    { label: 'Scrutin',     labelPlural: 'Scrutins',     icon: Vote,     color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', filterKey: 'scrutins' },
  lobbyiste:  { label: 'Lobbyiste',   labelPlural: 'Lobbyistes',   icon: Building2, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',   filterKey: 'lobbyistes' },
  dossier:    { label: 'Dossier',     labelPlural: 'Dossiers',     icon: FileText, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',     filterKey: 'dossiers' },
  groupe:     { label: 'Groupe',      labelPlural: 'Groupes',      icon: Landmark, color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', filterKey: 'groupes' },
  commission: { label: 'Commission',  labelPlural: 'Commissions',  icon: BookOpen, color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',       filterKey: 'commissions' },
  sujet:      { label: 'Sujet',       labelPlural: 'Sujets',       icon: Tag,      color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',       filterKey: 'sujets' },
};

const SECTION_ORDER: { key: string; type: string }[] = [
  { key: 'deputes',     type: 'depute' },
  { key: 'senateurs',   type: 'senateur' },
  { key: 'groupes',     type: 'groupe' },
  { key: 'commissions', type: 'commission' },
  { key: 'scrutins',    type: 'scrutin' },
  { key: 'sujets',      type: 'sujet' },
  { key: 'lobbyistes',  type: 'lobbyiste' },
  { key: 'dossiers',    type: 'dossier' },
];

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all',         label: 'Tout' },
  { value: 'deputes',     label: 'Députés' },
  { value: 'senateurs',   label: 'Sénateurs' },
  { value: 'groupes',     label: 'Groupes' },
  { value: 'commissions', label: 'Commissions' },
  { value: 'scrutins',    label: 'Scrutins' },
  { value: 'sujets',      label: 'Sujets' },
  { value: 'lobbyistes',  label: 'Lobbyistes' },
  { value: 'dossiers',    label: 'Dossiers' },
];

// =============================================================================
// Helpers
// =============================================================================

const formatDossierTitre = (titre: string, procedureLibelle?: string | null): string => {
  const firstChar = titre.charAt(0);
  if (firstChar !== firstChar.toUpperCase() && procedureLibelle) {
    return `${procedureLibelle} ${titre}`;
  }
  return titre;
};

function getResultLink(result: SearchResult): string {
  switch (result._type) {
    case 'depute':
    case 'senateur':
      return result.chambre === 'senat'
        ? `/senateurs/${result.slug}`
        : `/deputes/${result.slug}`;
    case 'scrutin':
      return scrutinHref({
        numero: result.numero!,
        chambre: result.chambre,
        session: result.session,
      });
    case 'lobbyiste':  return `/lobbying/${result.id}`;
    case 'dossier':    return `/dossiers/${result.uid}`;
    case 'groupe':     return `/groupes/${result.chambre || 'assemblee'}/${result.slug}`;
    case 'commission': return `/commissions/${result.slug}`;
    case 'sujet':      return `/sujets/${result.slug}`;
    default:           return '#';
  }
}

/**
 * Libellé d'un mandat clos. L'AN se date par sa législature, le Sénat n'a pas de
 * cohorte équivalente : on s'y rabat sur l'année de fin de mandat.
 * Voir SPEC-MULTI-LEGISLATURES.md (ticket #13).
 */
function ancienLabel(result: SearchResult): string {
  const senat = result.chambre === 'senat';
  // Accord en genre : `sexe` est renseigné pour l'intégralité du corpus. Sans lui,
  // on retombe sur une formule neutre plutôt que sur un masculin par défaut.
  const titre =
    result.sexe === 'F'
      ? (senat ? 'Ancienne sénatrice' : 'Ancienne députée')
      : result.sexe === 'M'
        ? (senat ? 'Ancien sénateur' : 'Ancien député')
        : 'Mandat clos';
  const mandat = result.dernierMandat;
  if (!mandat) return titre;

  if (mandat.legislature != null) {
    return `${titre} · ${legislatureLabel(mandat.legislature)}`;
  }
  if (mandat.dateFin) {
    const annee = new Date(mandat.dateFin).getUTCFullYear();
    if (Number.isFinite(annee)) return `${titre} · jusqu'en ${annee}`;
  }
  return titre;
}

function getDisplayType(result: SearchResult): string {
  if (result._type === 'depute' || result._type === 'senateur') {
    return result.chambre === 'senat' ? 'senateur' : 'depute';
  }
  return result._type;
}

// =============================================================================
// Result card
// =============================================================================

function ResultCard({ result }: { result: SearchResult }) {
  const displayType = getDisplayType(result);
  const config = typeConfig[displayType]!;
  const Icon = config.icon;
  const isParlementaire = displayType === 'depute' || displayType === 'senateur';

  return (
    <Link
      href={getResultLink(result)}
      className="block rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
    >
      <div className="flex items-start gap-4">
        {isParlementaire && result.photoUrl ? (
          <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-muted">
            <Image
              src={result.photoUrl}
              alt={result.nomComplet || `${result.prenom} ${result.nom}`}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className={`p-3 rounded-lg ${config.color}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {isParlementaire && (
            <>
              <h3 className="font-semibold flex flex-wrap items-center gap-2">
                {result.nomComplet || `${result.prenom} ${result.nom}`}
                {result.ancien && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {ancienLabel(result)}
                  </span>
                )}
              </h3>
              {result.groupe && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: result.groupeCouleur || '#888' }} />
                  {result.groupe}
                </p>
              )}
              {result.circonscription && (
                <p className="text-xs text-muted-foreground">
                  {result.circonscription} {result.departement && `(${result.departement})`}
                </p>
              )}
            </>
          )}

          {result._type === 'scrutin' && (
            <>
              <h3 className="font-semibold line-clamp-2">{result.titre}</h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <span>Scrutin n&deg;{result.numero}</span>
                <span>&bull;</span>
                <span className={result.sort === 'adopte' ? 'text-adopte' : 'text-rejete'}>
                  {result.sort === 'adopte' ? 'Adopté' : 'Rejeté'}
                </span>
              </div>
            </>
          )}

          {result._type === 'lobbyiste' && (
            <>
              <h3 className="font-semibold">{result.nom}</h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                {result.type && <span>{result.type}</span>}
                {result.secteur && (<><span>&bull;</span><span>{result.secteur}</span></>)}
              </div>
            </>
          )}

          {result._type === 'dossier' && (
            <>
              <h3 className="font-semibold line-clamp-2">{formatDossierTitre(result.titre || '', result.procedureLibelle)}</h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                {(() => {
                  const etatInfo = getDossierEtat(result.etat);
                  return etatInfo ? <span className={etatInfo.color}>{etatInfo.label}</span> : null;
                })()}
                {result.loiNumero && (<><span>&bull;</span><span className="text-green-700 font-medium">Loi n&deg;{result.loiNumero}</span></>)}
              </div>
            </>
          )}

          {result._type === 'groupe' && (
            <>
              <h3 className="font-semibold flex items-center gap-2">
                {result.couleur && <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: result.couleur }} />}
                {result.nom}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <span>{result.chambre === 'senat' ? 'Sénat' : 'Assemblée nationale'}</span>
                {result.statsMembresActifs != null && result.statsMembresActifs > 0 && (
                  <><span>&bull;</span><span>{result.statsMembresActifs} membres</span></>
                )}
              </div>
            </>
          )}

          {result._type === 'commission' && (
            <>
              <h3 className="font-semibold line-clamp-2 flex flex-wrap items-center gap-2">
                {result.nomCourt || result.nom}
                {result.actif === false && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Dissoute
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <span>{result.chambre === 'senat' ? 'Sénat' : 'Assemblée nationale'}</span>
                {result.type && (<><span>&bull;</span><span className="capitalize">{result.type.replace(/_/g, ' ')}</span></>)}
              </div>
            </>
          )}

          {result._type === 'sujet' && (
            <>
              <h3 className="font-semibold line-clamp-2">{result.label}</h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                {result.category && <span className="capitalize">{result.category}</span>}
                {result.scrutinCount != null && result.scrutinCount > 0 && (
                  <><span>&bull;</span><span>{result.scrutinCount} scrutin{result.scrutinCount > 1 ? 's' : ''}</span></>
                )}
                {result.dossierCount != null && result.dossierCount > 0 && (
                  <><span>&bull;</span><span>{result.dossierCount} dossier{result.dossierCount > 1 ? 's' : ''}</span></>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

// =============================================================================
// Page
// =============================================================================

export default function RecherchePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<FilterType>('all');
  // Défaut : la recherche décrit le Parlement d'aujourd'hui. Les mandats clos
  // s'ajoutent sur demande et l'état reste partageable via l'URL.
  const [inclureAnciens, setInclureAnciens] = useState(
    searchParams.get('anciens') === '1',
  );

  const buildUrl = (value: string, anciens: boolean) => {
    const params = new URLSearchParams();
    if (value) params.set('q', value);
    if (anciens) params.set('anciens', '1');
    const qs = params.toString();
    return qs ? `/recherche?${qs}` : '/recherche';
  };

  const debouncedSetQuery = useDebouncedCallback((value: string) => {
    setDebouncedQuery(value);
    router.replace(buildUrl(value, inclureAnciens), { scroll: false });
  }, 300);

  useEffect(() => {
    debouncedSetQuery(query);
  }, [query, debouncedSetQuery]);

  const toggleAnciens = (next: boolean) => {
    setInclureAnciens(next);
    router.replace(buildUrl(debouncedQuery, next), { scroll: false });
  };

  const enabled = debouncedQuery.length >= 2;

  // ---- Query: type=all (sections preview) ----
  const allQuery = useQuery<AllSearchResponse>({
    queryKey: ['search', debouncedQuery, 'all', inclureAnciens],
    queryFn: () =>
      api
        .get('/search', {
          params: { q: debouncedQuery, type: 'all', inclureAnciens: String(inclureAnciens) },
        })
        .then(r => r.data),
    enabled: enabled && filter === 'all',
  });

  // ---- Query: specific filter (paginated) ----
  const filteredQuery = useInfiniteQuery<FilteredSearchResponse>({
    queryKey: ['search-filtered', debouncedQuery, filter, inclureAnciens],
    queryFn: ({ pageParam = 1 }) =>
      api.get('/search', {
        params: {
          q: debouncedQuery,
          type: filter,
          limit: PAGE_SIZE,
          page: pageParam,
          inclureAnciens: String(inclureAnciens),
        },
      }).then(r => r.data),
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNext ? (lastPage.meta.page ?? 1) + 1 : undefined,
    initialPageParam: 1,
    enabled: enabled && filter !== 'all',
  });

  const { loadMoreRef } = useInfiniteScroll({
    hasNextPage: filteredQuery.hasNextPage,
    isFetchingNextPage: filteredQuery.isFetchingNextPage,
    fetchNextPage: filteredQuery.fetchNextPage,
  });

  // ---- Derived state ----
  const isAll = filter === 'all';
  const isLoading = isAll ? allQuery.isLoading : filteredQuery.isLoading;
  const isFetching = isAll ? allQuery.isFetching : (filteredQuery.isFetching && !filteredQuery.isFetchingNextPage);
  const error = isAll ? allQuery.error : filteredQuery.error;
  const hasData = isAll ? !!allQuery.data : !!filteredQuery.data;

  const counts: SearchCounts | undefined =
    allQuery.data?.meta.counts ?? filteredQuery.data?.pages[0]?.meta.counts;

  const filteredResults = filteredQuery.data?.pages.flatMap(p => p.data) ?? [];

  const anciensDisponibles =
    allQuery.data?.meta.anciensDisponibles ??
    filteredQuery.data?.pages[0]?.meta.anciensDisponibles ??
    0;

  const getChipCount = (value: FilterType): number | undefined => {
    if (!counts) return undefined;
    if (value === 'all') return counts.total;
    return counts[value as keyof SearchCounts] as number;
  };

  // ---- Render ----
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Recherche</h1>
        <p className="mt-2 text-muted-foreground">
          Trouvez des parlementaires, groupes, commissions, scrutins, sujets, lobbyistes et dossiers
        </p>
      </div>

      {/* Search input */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full rounded-xl border bg-background px-12 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
          {isFetching && (
            <Loader2 className="absolute right-12 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground animate-spin" />
          )}
        </div>
      </div>

      {/* Anciens parlementaires — hors des chips de type, c'est un axe orthogonal */}
      {enabled && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <button
            type="button"
            role="switch"
            aria-checked={inclureAnciens}
            onClick={() => toggleAnciens(!inclureAnciens)}
            className="group inline-flex items-center gap-2.5 text-sm"
          >
            <span
              className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
                inclureAnciens ? 'bg-primary' : 'bg-muted-foreground/30 group-hover:bg-muted-foreground/40'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  inclureAnciens ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </span>
            <span className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              Inclure les anciens parlementaires et commissions
            </span>
          </button>
          {!inclureAnciens && anciensDisponibles > 0 && (
            <button
              onClick={() => toggleAnciens(true)}
              className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {anciensDisponibles.toLocaleString('fr-FR')} résultat
              {anciensDisponibles > 1 ? 's' : ''} archivé
              {anciensDisponibles > 1 ? 's' : ''} correspond
              {anciensDisponibles > 1 ? 'ent' : ''} aussi
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {FILTER_OPTIONS.map((f) => {
          const chipCount = getChipCount(f.value);
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                filter === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {f.label}
              {chipCount != null && (
                <span className="ml-1 opacity-70">({chipCount.toLocaleString('fr-FR')})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Empty / min chars states */}
      {!debouncedQuery && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Commencez à taper pour rechercher</p>
          <p className="text-sm mt-1">Minimum 2 caractères</p>
        </div>
      )}

      {debouncedQuery && debouncedQuery.length < 2 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Minimum 2 caractères requis</p>
        </div>
      )}

      {/* Loading */}
      {isLoading && enabled && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-1/3 rounded bg-muted" />
                  <div className="h-4 w-2/3 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Une erreur est survenue lors de la recherche.
        </div>
      )}

      {/* ===================== type=all: grouped sections ===================== */}
      {isAll && allQuery.data && !isLoading && (
        <>
          {counts?.total === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun résultat trouvé</p>
              <p className="text-sm mt-1">Essayez avec d&apos;autres termes</p>
            </div>
          ) : (
            <div className="space-y-8">
              {SECTION_ORDER.map(({ key, type: sectionType }) => {
                const items = allQuery.data!.sections[key];
                if (!items || items.length === 0) return null;
                const config = typeConfig[sectionType]!;
                const Icon = config.icon;
                const total = counts?.[key as keyof SearchCounts] as number | undefined;

                return (
                  <section key={key}>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="flex items-center gap-2 text-lg font-semibold">
                        <div className={`p-1.5 rounded-md ${config.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        {config.labelPlural}
                        {total != null && (
                          <span className="text-sm font-normal text-muted-foreground">({total.toLocaleString('fr-FR')})</span>
                        )}
                      </h2>
                      {total != null && total > items.length && (
                        <button
                          onClick={() => setFilter(config.filterKey)}
                          className="flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          Voir les {total.toLocaleString('fr-FR')} résultats
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {items.map((result) => (
                        <ResultCard key={`${result._type}-${result.id || result.numero}`} result={result} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ============= specific filter: paginated infinite scroll ============= */}
      {!isAll && hasData && !isLoading && (
        <>
          {filteredResults.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun résultat trouvé</p>
              <p className="text-sm mt-1">Essayez avec d&apos;autres termes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredResults.map((result) => (
                <ResultCard key={`${result._type}-${result.id || result.numero}`} result={result} />
              ))}
            </div>
          )}

          <div ref={loadMoreRef} className="mt-8 flex justify-center py-4">
            {filteredQuery.isFetchingNextPage && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Chargement...</span>
              </div>
            )}
            {!filteredQuery.hasNextPage && filteredResults.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Tous les résultats ont été chargés
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
