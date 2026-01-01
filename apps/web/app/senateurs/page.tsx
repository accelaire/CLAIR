'use client';

import { useState, useEffect, Suspense } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Search, ChevronDown, Users, Loader2, Check, GitCompareArrows, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import {
  useComparisonSelection,
  ComparisonSelectionBar,
  SelectedParlementaire,
} from '@/components/comparison';

interface Senateur {
  id: string;
  slug: string;
  nom: string;
  prenom: string;
  photoUrl: string | null;
  serie: string | null;
  groupe: {
    slug: string;
    nom: string;
    couleur: string | null;
  } | null;
  circonscription: {
    departement: string;
    numero: number;
    nom: string;
  } | null;
}

interface SenateursResponse {
  data: Senateur[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
  };
}

function SenateursPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [groupe, setGroupe] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [preselectionHandled, setPreselectionHandled] = useState(false);

  // Paramètre de présélection depuis une fiche profil
  const compareSlug = searchParams.get('compare');

  // Hook de sélection pour la comparaison
  const {
    selected,
    isSelected,
    toggle,
    remove,
    clear,
    canCompare,
    compareUrl,
  } = useComparisonSelection({ chambre: 'senateurs' });

  // Mode comparaison actif si explicitement activé, si des éléments sont sélectionnés, ou si on a un compareSlug
  const isCompareActive = compareMode || selected.length > 0 || !!compareSlug;

  // Convertir un sénateur en format de sélection
  const toSelectedParlementaire = (senateur: Senateur): SelectedParlementaire => ({
    slug: senateur.slug,
    nom: senateur.nom,
    prenom: senateur.prenom,
    photoUrl: senateur.photoUrl,
    groupe: senateur.groupe,
  });

  // Quitter le mode comparaison
  const exitCompareMode = () => {
    setCompareMode(false);
    clear();
    // Retirer le paramètre compare de l'URL
    if (compareSlug) {
      router.replace('/senateurs', { scroll: false });
    }
  };

  // Fetch sénateurs avec infinite scroll
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<SenateursResponse>({
    queryKey: ['senateurs', { search, groupe }],
    queryFn: ({ pageParam = 1 }) =>
      api.get('/senateurs', {
        params: { search, groupe: groupe || undefined, page: pageParam, limit: 24 },
      }).then((res) => res.data),
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
  });

  // Fetch groupes pour le filtre
  const { data: groupesData } = useQuery({
    queryKey: ['groupes-senat'],
    queryFn: () => api.get('/senateurs/groupes').then((res) => res.data.data),
  });

  // Hook pour le scroll infini
  const { loadMoreRef } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  // Flatten all pages data
  const senateurs = data?.pages.flatMap((page) => page.data) ?? [];
  const total = data?.pages[0]?.meta.total ?? 0;

  // Gérer la présélection depuis une fiche profil
  useEffect(() => {
    if (compareSlug && senateurs.length > 0 && !preselectionHandled) {
      const senateurToPreselect = senateurs.find((s) => s.slug === compareSlug);
      if (senateurToPreselect && !isSelected(compareSlug)) {
        toggle(toSelectedParlementaire(senateurToPreselect));
        setPreselectionHandled(true);
      } else if (senateurToPreselect) {
        setPreselectionHandled(true);
      }
    }
  }, [compareSlug, senateurs, preselectionHandled, isSelected, toggle]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sénateurs</h1>
          <p className="mt-2 text-muted-foreground">
            {total > 0 ? total : '—'} sénateurs au Sénat de la République
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Source : <a href="https://data.senat.fr" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">data.senat.fr</a>
          </p>
        </div>

        {/* Bouton mode comparaison */}
        {!isCompareActive ? (
          <button
            onClick={() => setCompareMode(true)}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 hover:border-primary/40 transition-colors self-start"
          >
            <GitCompareArrows className="h-4 w-4" />
            <span>Comparer des sénateurs</span>
          </button>
        ) : (
          <button
            onClick={exitCompareMode}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted transition-colors self-start"
          >
            <X className="h-4 w-4" />
            <span>Quitter la comparaison</span>
          </button>
        )}
      </div>

      {/* Bandeau mode comparaison */}
      {isCompareActive && (
        <div className="mb-6 rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
          <p className="text-sm text-primary font-medium">
            <GitCompareArrows className="inline h-4 w-4 mr-2" />
            Mode comparaison actif — Cliquez sur les cartes pour sélectionner 2 à 4 sénateurs
          </p>
        </div>
      )}

      {/* Filtres */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row">
        {/* Recherche */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher un sénateur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-background px-10 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Filtre par groupe */}
        <div className="relative">
          <select
            value={groupe}
            onChange={(e) => setGroupe(e.target.value)}
            className="appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tous les groupes</option>
            {groupesData?.map((g: any) => (
              <option key={g.slug} value={g.slug}>
                {g.nom} ({g.membresCount})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Loading initial */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Une erreur est survenue lors du chargement des sénateurs.
        </div>
      )}

      {/* Liste des sénateurs */}
      {senateurs.length > 0 && (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            {total} résultat{total > 1 ? 's' : ''}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {senateurs.map((senateur) => {
              const senateurSelected = isSelected(senateur.slug);

              const cardContent = (
                <>
                  {/* Indicateur de sélection en mode comparaison */}
                  {isCompareActive && (
                    <div
                      className={`absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
                        senateurSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/30 bg-background'
                      }`}
                    >
                      {senateurSelected && <Check className="h-3.5 w-3.5" />}
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    {/* Photo */}
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                      {senateur.photoUrl ? (
                        <Image
                          src={senateur.photoUrl}
                          alt={`${senateur.prenom} ${senateur.nom}`}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <Users className="absolute inset-0 m-auto h-8 w-8 text-muted-foreground" />
                      )}
                    </div>

                    {/* Infos */}
                    <div className="min-w-0 flex-1">
                      <h3 className={`truncate font-semibold ${!isCompareActive ? 'group-hover:text-primary' : ''}`}>
                        {senateur.prenom} {senateur.nom}
                      </h3>

                      {/* Groupe */}
                      {senateur.groupe && (
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: senateur.groupe.couleur || '#888' }}
                          />
                          <span className="truncate text-sm text-muted-foreground">
                            {senateur.groupe.nom}
                          </span>
                        </div>
                      )}

                      {/* Circonscription / Série */}
                      {senateur.circonscription ? (
                        <p className="truncate text-xs text-muted-foreground mt-1">
                          {senateur.circonscription.nom}
                        </p>
                      ) : senateur.serie && (
                        <p className="truncate text-xs text-muted-foreground mt-1">
                          Série {senateur.serie}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              );

              const cardClassName = `group relative block w-full text-left rounded-lg border bg-card p-4 transition-all hover:shadow-md ${
                senateurSelected
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'hover:border-primary'
              }`;

              // En mode comparaison, utiliser un button, sinon un Link
              return isCompareActive ? (
                <button
                  key={senateur.id}
                  type="button"
                  onClick={() => toggle(toSelectedParlementaire(senateur))}
                  className={cardClassName}
                >
                  {cardContent}
                </button>
              ) : (
                <Link
                  key={senateur.id}
                  href={`/senateurs/${senateur.slug}`}
                  className={cardClassName}
                >
                  {cardContent}
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
            {!hasNextPage && senateurs.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Tous les sénateurs ont été chargés
              </p>
            )}
          </div>

          {/* Espace pour la barre de sélection */}
          {selected.length > 0 && <div className="h-24" />}
        </>
      )}

      {/* Barre de sélection pour comparaison */}
      <ComparisonSelectionBar
        selected={selected}
        chambre="senateurs"
        onRemove={remove}
        onClear={clear}
        compareUrl={compareUrl}
        canCompare={canCompare}
      />
    </div>
  );
}

export default function SenateursPage() {
  return (
    <Suspense fallback={<SenateursPageSkeleton />}>
      <SenateursPageContent />
    </Suspense>
  );
}

function SenateursPageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
