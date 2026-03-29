'use client';

import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, ChevronDown, Users, Loader2, Building2, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { getGroupColor } from '@/lib/colors';
import { HemicycleChart } from '@/components/charts/HemicycleChart';

interface GroupePolitique {
  id: string;
  slug: string;
  chambre: 'assemblee' | 'senat';
  nom: string;
  nomComplet: string | null;
  couleur: string | null;
  logoUrl: string | null;
  position: string | null;
  ordre: number;
  membresCount: number;
}

const chambreLabels: Record<string, string> = {
  assemblee: 'Assemblée nationale',
  senat: 'Sénat',
};

const positionLabels: Record<string, string> = {
  extreme_gauche: 'Extrême gauche',
  gauche: 'Gauche',
  centre_gauche: 'Centre-gauche',
  centre: 'Centre',
  centre_droit: 'Centre-droit',
  droite: 'Droite',
  extreme_droite: 'Extrême droite',
};

function GroupeCard({ groupe }: { groupe: GroupePolitique }) {
  const color = getGroupColor(groupe.nom, groupe.couleur, groupe.position);
  const chambreRoute = groupe.chambre === 'assemblee' ? 'deputes' : 'senateurs';

  return (
    <Link
      href={`/groupes/${groupe.chambre}/${groupe.slug}`}
      className="group relative flex flex-col rounded-xl border bg-card p-4 transition-all hover:shadow-lg hover:border-primary/30 overflow-hidden"
    >
      {/* Bande de couleur */}
      <div
        className="absolute left-0 top-0 h-full w-1.5 rounded-l-xl"
        style={{ backgroundColor: color }}
      />

      {/* Header avec logo/couleur et nom */}
      <div className="flex items-start gap-3 pl-2 min-w-0">
        {groupe.logoUrl ? (
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg flex items-center justify-center bg-white p-1 sm:p-1.5 shrink-0 border">
            <img
              src={groupe.logoUrl}
              alt={groupe.nom}
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div
            className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg flex items-center justify-center text-white font-bold text-base sm:text-lg shrink-0"
            style={{ backgroundColor: color }}
          >
            {groupe.nom.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0 overflow-hidden">
          <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors text-sm sm:text-base">
            {groupe.nom}
          </h3>
          {groupe.nomComplet && groupe.nomComplet !== groupe.nom && (
            <p className="text-xs sm:text-sm text-muted-foreground truncate" title={groupe.nomComplet}>
              {groupe.nomComplet}
            </p>
          )}
        </div>
      </div>

      {/* Infos */}
      <div className="mt-4 flex items-center justify-between pl-2 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap min-w-0">
          {/* Membres */}
          <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="font-medium text-foreground">{groupe.membresCount.toLocaleString('fr-FR')}</span>
            <span className="hidden xs:inline">membre{groupe.membresCount > 1 ? 's' : ''}</span>
          </div>

          {/* Position politique - hidden on very small screens */}
          {groupe.position && (
            <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {positionLabels[groupe.position] || groupe.position}
            </span>
          )}
        </div>

        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
      </div>

      {/* Badge chambre */}
      <div className="absolute top-3 right-3">
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          groupe.chambre === 'assemblee'
            ? 'badge-assemblee'
            : 'badge-senat'
        }`}>
          {groupe.chambre === 'assemblee' ? 'AN' : 'Sénat'}
        </span>
      </div>
    </Link>
  );
}

function GroupesPageContent() {
  const router = useRouter();

  // Sync filters with URL for back button preservation
  const [filters, setFilter] = useUrlFilters<{
    search: string;
    chambre: string;
  }>(['search', 'chambre']);

  // Fetch groupes
  const { data, isLoading, error } = useQuery<{ data: GroupePolitique[] }>({
    queryKey: ['groupes', filters.chambre],
    queryFn: () => {
      const endpoint = filters.chambre
        ? `/${filters.chambre === 'assemblee' ? 'deputes' : 'senateurs'}/groupes`
        : '/parlementaires/groupes';
      return api.get(endpoint).then((res) => res.data);
    },
  });

  const groupes = data?.data || [];

  // Tous les groupes par chambre (pour les hémicycles)
  const allAssemblee = groupes.filter((g) => g.chambre === 'assemblee');
  const allSenat = groupes.filter((g) => g.chambre === 'senat');

  // Filtrer par recherche
  const filteredGroupes = groupes.filter((g) => {
    if (!filters.search) return true;
    const search = filters.search.toLowerCase();
    return (
      g.nom.toLowerCase().includes(search) ||
      g.nomComplet?.toLowerCase().includes(search)
    );
  });

  // Séparer les groupes filtrés par chambre (pour les cartes)
  const assemblee = filteredGroupes.filter((g) => g.chambre === 'assemblee');
  const senat = filteredGroupes.filter((g) => g.chambre === 'senat');

  // Slugs des groupes filtrés (pour la surbrillance)
  const highlightedAssembleeSlugs = filters.search ? assemblee.map((g) => g.slug) : [];
  const highlightedSenatSlugs = filters.search ? senat.map((g) => g.slug) : [];

  // Stats des groupes filtrés
  const totalMembresAN = assemblee.reduce((acc, g) => acc + g.membresCount, 0);
  const totalMembresSenat = senat.reduce((acc, g) => acc + g.membresCount, 0);

  // Stats totaux (pour l'affichage)
  const totalMembresANAll = allAssemblee.reduce((acc, g) => acc + g.membresCount, 0);
  const totalMembresSenatAll = allSenat.reduce((acc, g) => acc + g.membresCount, 0);

  return (
    <div className="container mx-auto px-4 py-8 overflow-x-hidden">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Groupes parlementaires</h1>
        <p className="mt-2 text-muted-foreground">
          Explorez les groupes politiques de l&apos;Assemblée nationale et du Sénat
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          <Link href="/comprendre/groupes-politiques" className="underline hover:text-foreground">Comprendre les groupes politiques</Link>
        </p>
      </div>

      {/* Filtres */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row">
        {/* Recherche */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher un groupe..."
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            className="w-full rounded-lg border bg-background pl-10 pr-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Filtre chambre */}
        <div className="relative">
          <select
            value={filters.chambre}
            onChange={(e) => setFilter('chambre', e.target.value)}
            className="appearance-none rounded-lg border bg-background px-4 py-2.5 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Toutes les chambres</option>
            <option value="assemblee">Assemblée nationale</option>
            <option value="senat">Sénat</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
          Une erreur est survenue lors du chargement des groupes.
        </div>
      )}

      {/* Résultats */}
      {!isLoading && !error && (
        <>
          {/* Assemblée nationale */}
          {(!filters.chambre || filters.chambre === 'assemblee') && allAssemblee.length > 0 && (!filters.search || assemblee.length > 0) && (
            <section className="mb-10 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <Building2 className="h-5 w-5 text-purple-600 shrink-0" />
                  <h2 className="text-lg sm:text-xl font-semibold">Assemblée nationale</h2>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {filters.search ? `${assemblee.length}/${allAssemblee.length} groupes` : `${allAssemblee.length} groupes`}, {(filters.search ? totalMembresAN : totalMembresANAll).toLocaleString('fr-FR')} députés
                  </span>
                </div>
                <Link
                  href="/deputes"
                  className="text-sm text-primary hover:underline flex items-center gap-1 self-start sm:self-auto"
                >
                  Voir tous les députés
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {/* Hémicycle AN */}
              <div className="mb-6 rounded-xl border bg-card p-3 sm:p-6 overflow-hidden">
                <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-4 text-center">
                  Répartition des sièges
                </h3>
                <div className="h-[240px] sm:h-[320px] overflow-hidden">
                  <HemicycleChart
                    groupes={allAssemblee}
                    chambre="assemblee"
                    height={280}
                    highlightedSlugs={highlightedAssembleeSlugs}
                    onGroupClick={(g) => router.push(`/groupes/assemblee/${g.slug}`)}
                  />
                </div>
              </div>

              {assemblee.length > 0 ? (
                <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {assemblee.map((groupe) => (
                    <GroupeCard key={groupe.id} groupe={groupe} />
                  ))}
                </div>
              ) : filters.search && (
                <p className="text-center text-muted-foreground py-4">
                  Aucun groupe trouvé pour cette recherche.
                </p>
              )}
            </section>
          )}

          {/* Sénat */}
          {(!filters.chambre || filters.chambre === 'senat') && allSenat.length > 0 && (!filters.search || senat.length > 0) && (
            <section className="mb-10 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <Building2 className="h-5 w-5 text-blue-600 shrink-0" />
                  <h2 className="text-lg sm:text-xl font-semibold">Sénat</h2>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {filters.search ? `${senat.length}/${allSenat.length} groupes` : `${allSenat.length} groupes`}, {(filters.search ? totalMembresSenat : totalMembresSenatAll).toLocaleString('fr-FR')} sénateurs
                  </span>
                </div>
                <Link
                  href="/senateurs"
                  className="text-sm text-primary hover:underline flex items-center gap-1 self-start sm:self-auto"
                >
                  Voir tous les sénateurs
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {/* Hémicycle Sénat */}
              <div className="mb-6 rounded-xl border bg-card p-3 sm:p-6 overflow-hidden">
                <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-4 text-center">
                  Répartition des sièges
                </h3>
                <div className="h-[240px] sm:h-[320px] overflow-hidden">
                  <HemicycleChart
                    groupes={allSenat}
                    chambre="senat"
                    height={280}
                    highlightedSlugs={highlightedSenatSlugs}
                    onGroupClick={(g) => router.push(`/groupes/senat/${g.slug}`)}
                  />
                </div>
              </div>

              {senat.length > 0 ? (
                <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {senat.map((groupe) => (
                    <GroupeCard key={groupe.id} groupe={groupe} />
                  ))}
                </div>
              ) : filters.search && (
                <p className="text-center text-muted-foreground py-4">
                  Aucun groupe trouvé pour cette recherche.
                </p>
              )}
            </section>
          )}

          {/* Aucun résultat */}
          {filteredGroupes.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun groupe trouvé pour cette recherche.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function GroupesPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      }
    >
      <GroupesPageContent />
    </Suspense>
  );
}
