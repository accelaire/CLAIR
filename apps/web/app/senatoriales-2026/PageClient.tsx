'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Search, ChevronDown, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { FilterBar } from '@/components/FilterBar';
import { SortantCard } from './components/SortantCard';
import { RepartitionGroupes } from './components/RepartitionGroupes';

export interface ApercuSenatoriales {
  scrutin: {
    date: string;
    priseDeFonction: string;
    serie: string;
    mandatureSortante: number;
    mandatureEntrante: number;
    nbSieges: number;
    nbCirconscriptions: number;
    sources: { label: string; url?: string }[];
  };
  sortants: {
    total: number;
    mandatComplet: number;
    arriveesEnCours: number;
    parGroupe: GroupeRepartition[];
  };
  circonscriptions: {
    departement: string;
    nom: string;
    nbSieges: number;
  }[];
}

export interface GroupeRepartition {
  slug: string;
  nom: string;
  nomComplet: string | null;
  couleur: string | null;
  position: string | null;
  sieges: number;
}

/**
 * Nom affichable d'un groupe. L'API résout déjà `nom` vers le libellé d'usage du
 * Sénat ; il ne reste ici que le cas du mandat sans groupe rattaché.
 */
export function nomGroupe(groupe: { nom: string } | null): string {
  return groupe ? groupe.nom : 'Sans groupe';
}

export interface Sortant {
  mandatId: string;
  personne: {
    id: string;
    slug: string;
    nom: string;
    prenom: string;
    photoUrl: string | null;
    profession: string | null;
    dateNaissance: string | null;
  };
  groupe: {
    slug: string;
    nom: string;
    nomComplet: string | null;
    couleur: string | null;
    position: string | null;
  } | null;
  // `departement` est le code INSEE ('01', '997'), `nom` le libellé ('Ain').
  circonscription: {
    departement: string;
    nom: string;
  } | null;
  commissionPermanente: string | null;
  mandat: {
    dateDebut: string;
    dateFin: string | null;
    mandatComplet: boolean;
    dureeMois: number;
    segments: number;
    interrompu: boolean;
  };
  /** Statistiques de carrière — identiques à celles de la fiche du sénateur. */
  bilan: {
    presence: number | null;
    loyaute: number | null;
    participation: number | null;
    interventions: number | null;
    amendements: number | null;
    calculatedAt: string | null;
  };
}

// Effectif du Sénat fixé par l'article L.O. 274 du code électoral.
const SIEGES_SENAT = 348;

interface PageClientProps {
  initialApercu?: ApercuSenatoriales;
  initialSortants?: { data: Sortant[]; meta: { total: number } };
}

function SenatorialesPageContent({ initialApercu, initialSortants }: PageClientProps) {
  const [filters, setFilter, , clearAll] = useUrlFilters<{
    search: string;
    departement: string;
    groupe: string;
    tri: string;
  }>(['search', 'departement', 'groupe', 'tri']);

  const [countdownText, setCountdownText] = useState<string | null>(null);

  useEffect(() => {
    const target = new Date('2026-09-27');
    const priseDeFonction = new Date('2026-10-01');
    const now = new Date();
    if (now < target) {
      const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      setCountdownText(`J-${diff} avant le scrutin`);
    } else if (now < priseDeFonction) {
      setCountdownText('Scrutin passé');
    } else {
      setCountdownText('Les nouveaux sénateurs sont entrés en fonction');
    }
  }, []);

  const { data, isLoading, error } = useQuery<ApercuSenatoriales>({
    queryKey: ['senatoriales-2026'],
    queryFn: () => api.get('/senatoriales/2026').then((res) => res.data),
    initialData: initialApercu,
    // Aligné sur le `revalidate` du rendu serveur : sans délai de péremption,
    // React Query juge les données hydratées périmées dès le montage et relance
    // la requête, faisant transiter la liste une seconde fois pour rien.
    staleTime: 3_600_000,
  });

  const {
    data: sortantsData,
    isLoading: sortantsLoading,
    error: sortantsError,
  } = useQuery<{ data: Sortant[]; meta: { total: number } }>({
    queryKey: ['senatoriales-2026-sortants', { departement: filters.departement, groupe: filters.groupe, tri: filters.tri }],
    queryFn: () =>
      api
        .get('/senatoriales/2026/sortants', {
          params: {
            departement: filters.departement || undefined,
            groupe: filters.groupe || undefined,
            tri: filters.tri || undefined,
          },
        })
        .then((res) => res.data),
    initialData:
      !filters.departement && !filters.groupe && (!filters.tri || filters.tri === 'departement')
        ? initialSortants
        : undefined,
    // Aligné sur le `revalidate` du rendu serveur : sans délai de péremption,
    // React Query juge les données hydratées périmées dès le montage et relance
    // la requête, faisant transiter la liste une seconde fois pour rien.
    staleTime: 3_600_000,
  });

  const sortants = useMemo(() => sortantsData?.data ?? [], [sortantsData]);

  // Le tri n'entre pas dans le compte : il réordonne la liste, il ne la restreint pas.
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.departement) count++;
    if (filters.groupe) count++;
    return count;
  }, [filters.search, filters.departement, filters.groupe]);

  const handleClearFilters = () => {
    clearAll();
  };

  const filteredSortants = useMemo(() => {
    if (!filters.search) return sortants;
    const q = filters.search.toLowerCase();
    return sortants.filter((s) =>
      `${s.personne.prenom} ${s.personne.nom}`.toLowerCase().includes(q)
    );
  }, [sortants, filters.search]);

  // Regroupement par circonscription. La clé est le code INSEE (il ordonne
  // correctement, '01' avant '10'), mais le titre affiché est le libellé.
  const groupedSortants = useMemo(() => {
    if (filters.tri && filters.tri !== 'departement') return null;
    const map = new Map<string, { libelle: string; sortants: Sortant[] }>();
    for (const s of filteredSortants) {
      const code = s.circonscription?.departement ?? 'zzz';
      const libelle = s.circonscription?.nom ?? 'Circonscription non renseignée';
      if (!map.has(code)) map.set(code, { libelle, sortants: [] });
      map.get(code)!.sortants.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredSortants, filters.tri]);

  // L'erreur se teste avant le chargement : en cas d'échec `data` reste indéfini,
  // et l'ordre inverse afficherait le squelette indéfiniment.
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Une erreur est survenue lors du chargement des données.
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return <SenatorialesPageSkeleton />;
  }

  const { scrutin, sortants: apercuSortants, circonscriptions } = data;
  const nonRenouveles = SIEGES_SENAT - scrutin.nbSieges;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sénatoriales du 27 septembre 2026</h1>
          <p className="mt-2 text-muted-foreground">
            {scrutin.nbSieges} des {SIEGES_SENAT} sièges du Sénat sont renouvelés. Voici le
            bilan de mandature des sortants.
          </p>
          {countdownText && (
            <p className="mt-3 inline-flex items-center rounded-lg border bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
              {countdownText}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Comment fonctionne une élection sénatoriale ?</h2>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            Les sénateurs sont élus au suffrage <strong>indirect</strong>, par environ 162 000 grands électeurs (députés, conseillers régionaux et départementaux, et surtout délégués des conseils municipaux, qui forment près de 95 % du collège).
          </p>
          <p>
            Le Sénat se renouvelle <strong>par moitié tous les trois ans</strong>. Le 27 septembre 2026, c&apos;est la série 2 : {scrutin.nbSieges} sièges dans {scrutin.nbCirconscriptions} circonscriptions.
          </p>
          <p>
            Le mode de scrutin dépend du département : <strong>majoritaire à deux tours</strong> là où il y a un ou deux sièges, <strong>proportionnel de liste à un tour</strong> à partir de trois sièges.
          </p>
          <p>
            Les élus prennent leurs fonctions le <strong>1er octobre 2026</strong>. Le mandat dure six ans.
          </p>
        </div>
        {scrutin.sources.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-1">
            {scrutin.sources.map((source, i) =>
              source.url ? (
                <a
                  key={i}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  {source.label}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <span key={i} className="text-sm text-muted-foreground">
                  {source.label}
                </span>
              )
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-3xl font-bold">{scrutin.nbSieges.toLocaleString('fr-FR')}</p>
          <p className="text-sm text-muted-foreground">sièges renouvelés</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-3xl font-bold">{scrutin.nbCirconscriptions.toLocaleString('fr-FR')}</p>
          <p className="text-sm text-muted-foreground">départements concernés</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-3xl font-bold">{nonRenouveles.toLocaleString('fr-FR')}</p>
          <p className="text-sm text-muted-foreground">sièges non concernés</p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Répartition des sièges sortants par groupe</h2>
        <RepartitionGroupes parGroupe={apercuSortants.parGroupe} total={apercuSortants.total} />
      </div>

      <FilterBar
        activeFilterCount={activeFilterCount}
        onClear={handleClearFilters}
        search={
          <div className="relative flex-1 md:min-w-[10rem]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher un sortant..."
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              className="w-full rounded-lg border bg-background px-10 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        }
      >
        <div className="relative w-full md:w-52">
          <select
            value={filters.departement}
            onChange={(e) => setFilter('departement', e.target.value)}
            className="w-full appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tous les départements</option>
            {[...circonscriptions]
              .sort((a, b) => a.nom.localeCompare(b.nom))
              .map((c) => (
                <option key={c.departement} value={c.departement}>
                  {c.nom} ({c.nbSieges})
                </option>
              ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        <div className="relative w-full md:w-52">
          <select
            value={filters.groupe}
            onChange={(e) => setFilter('groupe', e.target.value)}
            className="w-full appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tous les groupes</option>
            {apercuSortants.parGroupe.map((g) => (
              <option key={g.slug} value={g.slug}>
                {nomGroupe(g)} ({g.sieges})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        <div className="relative w-full md:w-52">
          <select
            value={filters.tri}
            onChange={(e) => setFilter('tri', e.target.value)}
            className="w-full appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Trier par</option>
            <option value="departement">Par département</option>
            <option value="nom">Par nom</option>
            <option value="presence">Présence la plus forte</option>
            <option value="loyaute">Loyauté la plus forte</option>
            <option value="amendements">Le plus d&apos;amendements</option>
            <option value="interventions">Le plus d&apos;interventions</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </FilterBar>

      {sortantsLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : sortantsError ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Une erreur est survenue lors du chargement des sortants.
        </div>
      ) : filteredSortants.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun sortant ne correspond aux critères.</p>
      ) : groupedSortants ? (
        <div className="space-y-8">
          {groupedSortants.map(([code, { libelle, sortants: list }]) => (
            <div key={code}>
              <h3 className="mb-3 text-lg font-semibold">
                {libelle} · {list.length} siège{list.length > 1 ? 's' : ''}
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((sortant) => (
                  <SortantCard key={sortant.mandatId} sortant={sortant} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSortants.map((sortant) => (
            <SortantCard key={sortant.mandatId} sortant={sortant} />
          ))}
        </div>
      )}

      <div className="text-sm text-muted-foreground space-y-2">
        <p>
          Les chiffres affichés sont ceux de la <strong>carrière au Sénat</strong> de
          chaque sortant : ce sont exactement ceux de sa fiche. Les taux de présence et
          de loyauté sont comparables entre eux ; les compteurs d&apos;interventions et
          d&apos;amendements le sont moins, un sénateur arrivé en cours de mandature
          ayant eu moins d&apos;occasions de siéger — d&apos;où le badge sur sa carte.
        </p>
        <p>
          Quelques mandats ont été exercés en plusieurs périodes, une entrée au
          gouvernement suspendant le mandat parlementaire. Ces sénateurs portent le badge{' '}
          <em>mandat interrompu</em> ; leurs chiffres couvrent bien l&apos;ensemble de
          leur passage au Sénat, et non la seule période en cours.
        </p>
        <p>
          <Link href="/methodologie" className="underline hover:text-foreground">
            En savoir plus sur la méthodologie
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function PageClient({ initialApercu, initialSortants }: PageClientProps) {
  return (
    <Suspense fallback={<SenatorialesPageSkeleton />}>
      <SenatorialesPageContent
        initialApercu={initialApercu}
        initialSortants={initialSortants}
      />
    </Suspense>
  );
}

function SenatorialesPageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="mb-8">
        <div className="h-8 w-80 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-6 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
            <div className="h-8 w-16 rounded bg-muted" />
            <div className="mt-2 h-4 w-32 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="h-6 w-48 animate-pulse rounded bg-muted" />
      <div className="h-8 w-full animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-muted" />
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