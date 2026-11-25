'use client';

import { Suspense, useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronDown, Landmark, Loader2, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { aucunFiltre, STALE_TIME_LISTE_MS } from '@/lib/liste-ssr';
import { FilterBar } from '@/components/FilterBar';
import { PetitionCard } from '@/components/petitions/PetitionCard';
import {
  LIBELLE_ETAPE,
  SEUIL_SUIVIE,
  type PetitionResume,
  type PetitionsFiltres,
  type PetitionsResponse,
  type TypeEtapePetition,
} from '@/lib/petitions';

interface PageClientProps {
  /** Première page sans filtre, récupérée côté serveur (cf. `lib/liste-ssr`). */
  initialPetitions?: PetitionsResponse;
  initialPage?: number;
}

const CLES = ['search', 'chambre', 'commission', 'collecte', 'etape', 'suivies', 'sort'] as const;
type Filtres = Record<(typeof CLES)[number], string>;

const SELECT = 'w-full appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary';

function Choix({ value, onChange, label, children }: { value: string; onChange: (v: string) => void; label: string; children: React.ReactNode }) {
  return (
    <div className="relative md:w-auto md:max-w-[260px]">
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={`${SELECT} truncate`}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function PetitionsContent({ initialPetitions, initialPage = 1 }: PageClientProps) {
  const [filters, setFilter, , clearAll] = useUrlFilters<Filtres>([...CLES]);

  const { data: filtres } = useQuery<PetitionsFiltres>({
    queryKey: ['petitions-filtres'],
    queryFn: () => api.get('/petitions/filtres').then((res) => res.data),
    staleTime: STALE_TIME_LISTE_MS,
  });

  const params = {
    search: filters.search || undefined,
    chambre: filters.chambre || undefined,
    commission: filters.commission || undefined,
    collecte: filters.collecte || undefined,
    etape: filters.etape || undefined,
    suivies: filters.suivies || undefined,
    sort: filters.sort || undefined,
  };

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<PetitionsResponse>({
    queryKey: ['petitions', params],
    queryFn: ({ pageParam = 1 }) =>
      api.get('/petitions', { params: { ...params, page: pageParam, limit: 20 } }).then((res) => res.data),
    getNextPageParam: (last) => (last.meta.hasNext ? last.meta.page + 1 : undefined),
    initialPageParam: initialPage,
    initialData:
      initialPetitions && aucunFiltre(CLES.map((k) => filters[k]))
        ? { pages: [initialPetitions], pageParams: [initialPage] }
        : undefined,
    staleTime: STALE_TIME_LISTE_MS,
  });

  const { loadMoreRef } = useInfiniteScroll({ hasNextPage, isFetchingNextPage, fetchNextPage });

  const petitions = data?.pages.flatMap((p) => p.data) ?? [];
  const total = data?.pages[0]?.meta.total ?? 0;
  const activeFilterCount = useMemo(
    () => CLES.filter((k) => k !== 'search' && k !== 'sort' && filters[k]).length,
    [filters],
  );
  // Les dernières étapes, avec la même sélection que l'accueil : la liste
  // reste triée par signatures, le bandeau donne l'actualité.
  const { data: dernieresEtapes } = useQuery<PetitionResume[]>({
    queryKey: ['petitions-dernieres-etapes'],
    queryFn: () => api.get('/petitions/dernieres-etapes').then((res) => res.data),
    staleTime: STALE_TIME_LISTE_MS,
  });

  const totalEtape = (etape: string) => filtres?.etapes.find((e) => e.etape === etape)?.total;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Pétitions citoyennes</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Les pétitions déposées à l&apos;Assemblée nationale et au Sénat, et ce qu&apos;elles deviennent :
          rapporteur nommé, décision de la commission, rapport. Le parcours est lu dans l&apos;agenda des
          commissions et les dossiers parlementaires, pas seulement dans le statut affiché par les plateformes.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Sources : jeux « Pétitions de l&apos;Assemblée nationale » et « Pétitions du Sénat » de{' '}
          <a href="https://www.data.gouv.fr/datasets/petitions-de-lassemblee-nationale" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">data.gouv.fr</a>
          {' '}(Licence Ouverte), mis à jour chaque semaine ; agenda et dossiers de{' '}
          <a href="https://data.assemblee-nationale.fr" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">data.assemblee-nationale.fr</a>.
        </p>
      </div>

      {dernieresEtapes && dernieresEtapes.length > 0 && (
        <section className="mb-8" aria-labelledby="dernieres-etapes">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="dernieres-etapes" className="flex items-center gap-2 text-lg font-semibold">
              <Landmark className="h-5 w-5 text-primary" aria-hidden />
              Dernières étapes au Parlement
            </h2>
            <button
              type="button"
              onClick={() => {
                setFilter('sort', 'etape');
                document.getElementById('liste-petitions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Toutes, par étape la plus récente
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {dernieresEtapes.map((p) => (
              <PetitionCard key={`${p.chambre}-${p.numero}`} petition={p} />
            ))}
          </div>
        </section>
      )}

      {/* Cible du lien du bandeau ; la marge laisse la place de l'en-tête collant. */}
      <div id="liste-petitions" className="scroll-mt-20" />
      <FilterBar
        activeFilterCount={activeFilterCount}
        onClear={() => clearAll()}
        search={
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher un titre ou un numéro…"
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              className="w-full rounded-lg border bg-background px-10 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        }
      >
        <Choix value={filters.suivies} onChange={(v) => setFilter('suivies', v)} label="Pétitions suivies">
          <option value="">Toutes les pétitions</option>
          <option value="true">
            Suivies : {SEUIL_SUIVIE.toLocaleString('fr-FR')} signatures ou en commission{filtres ? ` (${filtres.suivies})` : ''}
          </option>
        </Choix>
        <Choix value={filters.chambre} onChange={(v) => setFilter('chambre', v)} label="Chambre">
          <option value="">Les deux chambres</option>
          <option value="assemblee">Assemblée nationale</option>
          <option value="senat">Sénat</option>
        </Choix>
        <Choix value={filters.etape} onChange={(v) => setFilter('etape', v)} label="Dernière étape">
          <option value="">Toutes les étapes</option>
          {(Object.keys(LIBELLE_ETAPE) as TypeEtapePetition[]).map((e) => (
            <option key={e} value={e}>
              {LIBELLE_ETAPE[e]}{totalEtape(e) !== undefined ? ` (${totalEtape(e)})` : ''}
            </option>
          ))}
          <option value="aucune">Aucune étape</option>
        </Choix>
        {filtres && filtres.commissions.length > 0 && (
          <Choix value={filters.commission} onChange={(v) => setFilter('commission', v)} label="Commission">
            <option value="">Toutes les commissions</option>
            {filtres.commissions.map((c) => (
              <option key={c.slug} value={c.slug}>{c.nom} ({c.total})</option>
            ))}
          </Choix>
        )}
        <Choix value={filters.collecte} onChange={(v) => setFilter('collecte', v)} label="Collecte">
          <option value="">Collecte ouverte ou close</option>
          <option value="ouverte">Signatures ouvertes</option>
          <option value="close">Collecte close</option>
        </Choix>
        <Choix value={filters.sort} onChange={(v) => setFilter('sort', v)} label="Tri">
          <option value="">Les plus signées</option>
          <option value="etape">Étape la plus récente</option>
          <option value="date">Les plus récentes</option>
        </Choix>
      </FilterBar>

      {total > 0 && (
        <p className="mb-4 text-sm text-muted-foreground">
          {total.toLocaleString('fr-FR')} pétition{total > 1 ? 's' : ''}
        </p>
      )}

      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
              <div className="mb-2 h-5 w-3/4 rounded bg-muted" />
              <div className="h-4 w-1/2 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Une erreur est survenue lors du chargement des pétitions.
        </div>
      )}

      {!isLoading && !error && petitions.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">Aucune pétition ne correspond à ces filtres.</p>
      )}

      {petitions.length > 0 && (
        <>
          <div className="space-y-4">
            {petitions.map((p) => (
              <PetitionCard key={`${p.chambre}-${p.numero}`} petition={p} />
            ))}
          </div>
          <div ref={loadMoreRef} className="mt-8 flex justify-center py-4">
            {isFetchingNextPage && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Chargement...</span>
              </div>
            )}
            {!hasNextPage && <p className="text-sm text-muted-foreground">Toutes les pétitions ont été chargées</p>}
          </div>
        </>
      )}
    </div>
  );
}

export default function PageClient(props: PageClientProps) {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
                <div className="mb-2 h-5 w-3/4 rounded bg-muted" />
                <div className="h-4 w-1/2 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      }
    >
      <PetitionsContent {...props} />
    </Suspense>
  );
}
