'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Users, Vote, Building2, ArrowRight, Calendar, BarChart3, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useCountUp } from '@/hooks/useCountUp';
import { LobbyisteLogo } from '@/components/lobbying';

// Labels pour les cibles de lobbying
const cibleLabels: Record<string, string> = {
  parlementaire: 'Parlement',
  depute: 'Parlement',
  ministre: 'Gouvernement',
  presidence: 'Présidence',
  collectivite: 'Collectivités',
  autorite: 'AAI/API',
  administration: 'Administration',
};

// Extraire le secteur entre crochets de la description
const extractSecteur = (description: string): { secteur: string | null; cleanDescription: string } => {
  const match = description.match(/^\[([^\]]+)\]\s*/);
  if (match) {
    return { secteur: match[1], cleanDescription: description.replace(match[0], '') };
  }
  return { secteur: null, cleanDescription: description };
};

// Couleurs pour les secteurs
const secteurColorClasses = [
  'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
];

const getSecteurColor = (secteur: string): string => {
  let hash = 0;
  for (let i = 0; i < secteur.length; i++) {
    hash = secteur.charCodeAt(i) + ((hash << 5) - hash);
  }
  return secteurColorClasses[Math.abs(hash) % secteurColorClasses.length];
};

interface Stats {
  deputes: number;
  senateurs: number;
  scrutins: number;
  dossiers: number;
  lobbyistes: number;
  actionsLobby: number;
  interventions: number;
  amendements: number;
}

interface TrendingDossierScrutin {
  numero: number;
  chambre: string;
  session: string;
  date: string;
  titre: string;
  sort: string;
  nombrePour: number;
  nombreContre: number;
}

interface TrendingDossier {
  id: string;
  uid: string;
  titre: string;
  titreCourt: string | null;
  chambre: string;
  etat: string | null;
  procedureLibelle: string | null;
  scrutinsCount: number;
  lastScrutinDate: string | null;
  scrutins: TrendingDossierScrutin[];
}

const formatDossierTitre = (titre: string, procedureLibelle?: string | null): string => {
  const firstChar = titre.charAt(0);
  if (firstChar !== firstChar.toUpperCase() && procedureLibelle) {
    return `${procedureLibelle} ${titre}`;
  }
  return titre;
};

const dossierEtatLabels: Record<string, { label: string; color: string }> = {
  en_cours: { label: 'En cours', color: 'bg-amber-100 text-amber-700' },
  adopte: { label: 'Adopté', color: 'bg-blue-100 text-blue-700' },
  rejete: { label: 'Rejeté', color: 'bg-red-100 text-red-700' },
  promulgue: { label: 'Promulgué', color: 'bg-green-100 text-green-700' },
};

interface RecentAction {
  id: string;
  description: string;
  cible: string | null;
  dateDebut: string;
  lobbyiste: {
    id: string;
    nom: string;
    type: string | null;
    secteur: string | null;
    siteWeb: string | null;
  };
}

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch homepage data (stats + recent scrutins + recent actions + trending dossiers in ONE call)
  const { data: homepageData } = useQuery<{ stats: Stats; recentActions: RecentAction[]; trendingDossiers: TrendingDossier[]; lastUpdate: string | null }>({
    queryKey: ['homepage'],
    queryFn: () => api.get('/homepage').then(res => res.data),
    staleTime: 30000, // Refresh every 30 seconds
    refetchOnWindowFocus: true,
  });

  const stats = homepageData?.stats;
  const recentActions = homepageData?.recentActions;
  const trendingDossiers = homepageData?.trendingDossiers;

  // Animated counters
  const deputesCount = useCountUp(stats?.deputes);
  const senateursCount = useCountUp(stats?.senateurs);
  const scrutinsCount = useCountUp(stats?.scrutins);
  const dossiersCount = useCountUp(stats?.dossiers);
  const lobbyistesCount = useCountUp(stats?.lobbyistes);
  const actionsCount = useCountUp(stats?.actionsLobby);
  const interventionsCount = useCountUp(stats?.interventions);
  const amendementsCount = useCountUp(stats?.amendements);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/recherche?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              La politique française,{' '}
              <span className="text-primary">en clair</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              Analysez les votes des députés et sénateurs, suivez le lobbying et vérifiez les promesses.
              Toutes les données publiques, enfin accessibles.
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="mt-10">
              <div className="relative mx-auto max-w-xl">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un député, un sénateur, un scrutin..."
                  className="w-full rounded-xl border bg-background px-12 py-4 text-base focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Rechercher
                </button>
              </div>
            </form>

            {/* Quick Stats - Clickable with animation */}
            <div className="mt-12 flex flex-wrap justify-center gap-3">
              <Link
                href="/deputes"
                className="w-[calc(50%-6px)] sm:w-[150px] rounded-lg border bg-card p-3 transition-all hover:border-primary hover:shadow-md hover:scale-105"
              >
                <div className="text-xl font-bold text-primary tabular-nums">
                  {stats?.deputes ? deputesCount.toLocaleString('fr-FR') : '—'}
                </div>
                <div className="text-xs text-muted-foreground">Députés</div>
              </Link>
              <Link
                href="/senateurs"
                className="w-[calc(50%-6px)] sm:w-[150px] rounded-lg border bg-card p-3 transition-all hover:border-primary hover:shadow-md hover:scale-105"
              >
                <div className="text-xl font-bold text-primary tabular-nums">
                  {stats?.senateurs ? senateursCount.toLocaleString('fr-FR') : '—'}
                </div>
                <div className="text-xs text-muted-foreground">Sénateurs</div>
              </Link>
              <Link
                href="/scrutins"
                className="w-[calc(50%-6px)] sm:w-[150px] rounded-lg border bg-card p-3 transition-all hover:border-primary hover:shadow-md hover:scale-105"
              >
                <div className="text-xl font-bold text-primary tabular-nums">
                  {stats?.scrutins ? scrutinsCount.toLocaleString('fr-FR') : '—'}
                </div>
                <div className="text-xs text-muted-foreground">Scrutins</div>
              </Link>
              <Link
                href="/dossiers"
                className="w-[calc(50%-6px)] sm:w-[150px] rounded-lg border bg-card p-3 transition-all hover:border-primary hover:shadow-md hover:scale-105"
              >
                <div className="text-xl font-bold text-primary tabular-nums">
                  {stats?.dossiers ? dossiersCount.toLocaleString('fr-FR') : '—'}
                </div>
                <div className="text-xs text-muted-foreground">Dossiers</div>
              </Link>
              <Link
                href="/deputes"
                className="w-[calc(50%-6px)] sm:w-[150px] rounded-lg border bg-card p-3 transition-all hover:border-primary hover:shadow-md hover:scale-105"
              >
                <div className="text-xl font-bold text-primary tabular-nums">
                  {stats?.interventions ? interventionsCount.toLocaleString('fr-FR') : '—'}
                </div>
                <div className="text-xs text-muted-foreground">Interventions</div>
              </Link>
              <Link
                href="/deputes"
                className="w-[calc(50%-6px)] sm:w-[150px] rounded-lg border bg-card p-3 transition-all hover:border-primary hover:shadow-md hover:scale-105"
              >
                <div className="text-xl font-bold text-primary tabular-nums">
                  {stats?.amendements ? amendementsCount.toLocaleString('fr-FR') : '—'}
                </div>
                <div className="text-xs text-muted-foreground">Amendements</div>
              </Link>
              <Link
                href="/lobbying"
                className="w-[calc(50%-6px)] sm:w-[150px] rounded-lg border bg-card p-3 transition-all hover:border-primary hover:shadow-md hover:scale-105"
              >
                <div className="text-xl font-bold text-primary tabular-nums">
                  {stats?.lobbyistes ? lobbyistesCount.toLocaleString('fr-FR') : '—'}
                </div>
                <div className="text-xs text-muted-foreground">Lobbyistes</div>
              </Link>
              <Link
                href="/lobbying"
                className="w-[calc(50%-6px)] sm:w-[150px] rounded-lg border bg-card p-3 transition-all hover:border-primary hover:shadow-md hover:scale-105"
              >
                <div className="text-xl font-bold text-primary tabular-nums">
                  {stats?.actionsLobby ? actionsCount.toLocaleString('fr-FR') : '—'}
                </div>
                <div className="text-xs text-muted-foreground">Actions lobby</div>
              </Link>
            </div>

            {/* Dernière mise à jour */}
            {homepageData?.lastUpdate && (
              <p className="mt-4 text-right text-xs italic text-muted-foreground">
                Données mises à jour le {new Date(homepageData.lastUpdate).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })} à {new Date(homepageData.lastUpdate).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Trending Dossiers Législatifs - enriched with mini-scrutins */}
      {trendingDossiers && trendingDossiers.length > 0 && (
        <section className="py-16 overflow-hidden">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">Dossiers législatifs récents</h2>
              <Link
                href="/dossiers"
                className="flex items-center text-sm font-medium text-primary hover:underline"
              >
                Voir tous les dossiers
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="relative group">
            <button
              onClick={() => {
                const container = document.getElementById('dossiers-carousel');
                if (container) container.scrollBy({ left: -416, behavior: 'smooth' });
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-background/90 border shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
              aria-label="Précédent"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => {
                const container = document.getElementById('dossiers-carousel');
                if (container) container.scrollBy({ left: 416, behavior: 'smooth' });
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-background/90 border shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
              aria-label="Suivant"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div
              id="dossiers-carousel"
              className="overflow-x-auto pb-4 px-4 md:px-[max(1rem,calc((100%-768px)/2+1rem))] lg:px-[max(1rem,calc((100%-1024px)/2+1rem))] xl:px-[max(1rem,calc((100%-1280px)/2+1rem))] [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: 'none' }}
            >
              <div className="flex gap-4 w-max animate-carousel-scroll group-hover:[animation-play-state:paused]">
                {[...trendingDossiers, ...trendingDossiers].map((dossier, index) => (
                  <Link
                    key={`${dossier.id}-${index}`}
                    href={`/dossiers/${dossier.uid}`}
                    className="w-[400px] flex-shrink-0 rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
                  >
                    {/* Header: chambre + etat + procedure + scrutin count */}
                    <div className="flex items-center gap-2 mb-2 text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${dossier.chambre === 'senat' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {dossier.chambre === 'senat' ? 'Sénat' : 'AN'}
                      </span>
                      {dossier.etat && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${dossierEtatLabels[dossier.etat]?.color || 'bg-muted text-muted-foreground'}`}>
                          {dossierEtatLabels[dossier.etat]?.label || dossier.etat}
                        </span>
                      )}
                      {dossier.procedureLibelle && (
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600">
                          {dossier.procedureLibelle.length > 20 ? dossier.procedureLibelle.slice(0, 20) + '...' : dossier.procedureLibelle}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-muted-foreground text-xs ml-auto">
                        <Vote className="h-3 w-3" />
                        {dossier.scrutinsCount} scrutin{dossier.scrutinsCount > 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-medium line-clamp-2 mb-3">{formatDossierTitre(dossier.titre, dossier.procedureLibelle)}</h3>

                    {/* Mini-scrutins list */}
                    {dossier.scrutins && dossier.scrutins.length > 0 && (
                      <div className="border-t pt-2 space-y-1.5">
                        {dossier.scrutins.map((s) => (
                          <div key={`${s.numero}-${s.chambre}`} className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground w-[3.5rem] flex-shrink-0">
                              {formatDate(s.date)}
                            </span>
                            <span className="flex-1 min-w-0 truncate text-gray-700">{s.titre}</span>
                            <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              s.sort === 'adopte' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {s.sort === 'adopte' ? 'Adopté' : 'Rejeté'}
                            </span>
                            <span className="flex-shrink-0 text-[10px] text-muted-foreground tabular-nums">
                              {s.nombrePour}/{s.nombreContre}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Footer: last vote date */}
                    {dossier.lastScrutinDate && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2 pt-2 border-t">
                        <Calendar className="h-3 w-3" />
                        Dernier vote : {formatDate(dossier.lastScrutinDate)}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Recent Lobbying Actions */}
      {recentActions && recentActions.length > 0 && (
        <section className="py-16 border-b overflow-hidden">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">Dernières actions lobby déclarées</h2>
              <Link
                href="/lobbying/actions"
                className="flex items-center text-sm font-medium text-primary hover:underline"
              >
                Voir toutes les actions
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Carrousel avec auto-scroll */}
          <div className="relative group">
            {/* Boutons de navigation */}
            <button
              onClick={() => {
                const container = document.getElementById('actions-carousel');
                if (container) container.scrollBy({ left: -376, behavior: 'smooth' });
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-background/90 border shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
              aria-label="Précédent"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => {
                const container = document.getElementById('actions-carousel');
                if (container) container.scrollBy({ left: 376, behavior: 'smooth' });
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-background/90 border shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
              aria-label="Suivant"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Container scrollable */}
            <div
              id="actions-carousel"
              className="overflow-x-auto pb-4 px-4 md:px-[max(1rem,calc((100%-768px)/2+1rem))] lg:px-[max(1rem,calc((100%-1024px)/2+1rem))] xl:px-[max(1rem,calc((100%-1280px)/2+1rem))] [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: 'none' }}
            >
              <div className="flex gap-4 w-max animate-carousel-scroll group-hover:[animation-play-state:paused]">
                {/* Cartes dupliquées pour effet de boucle infinie */}
                {[...recentActions, ...recentActions].map((action, index) => {
                  const { secteur, cleanDescription } = extractSecteur(action.description || '');
                  return (
                    <Link
                      key={`${action.id}-${index}`}
                      href={`/lobbying/${action.lobbyiste.id}`}
                      className="w-[360px] flex-shrink-0 rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
                    >
                      {/* Tags: Secteur + Cible + Date */}
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
                        <span className="flex items-center gap-1 text-muted-foreground text-xs ml-auto">
                          <Calendar className="h-3 w-3" />
                          {new Date(action.dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="font-medium line-clamp-3 mb-3 min-h-[4.5rem]">
                        {cleanDescription || 'Objet non précisé'}
                      </p>

                      {/* Lobbyiste */}
                      <div className="flex items-center gap-3 pt-3 border-t">
                        <LobbyisteLogo siteWeb={action.lobbyiste.siteWeb} nom={action.lobbyiste.nom} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate">{action.lobbyiste.nom}</p>
                          {action.lobbyiste.secteur && (
                            <p className="text-xs text-muted-foreground truncate">{action.lobbyiste.secteur}</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-center text-3xl font-bold">
            Comprendre la politique en 30 secondes
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
            Fini les données dispersées et les interfaces illisibles.
            CLAIR agrège et simplifie l&apos;information politique pour vous.
          </p>

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {/* Feature 1: Députés */}
            <Link
              href="/deputes"
              className="group rounded-xl border bg-card p-8 transition-all hover:border-primary hover:shadow-lg"
            >
              <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Députés</h3>
              <p className="mt-2 text-muted-foreground">
                Votes, présence, loyauté au groupe... Tout savoir sur votre député.
              </p>
              <div className="mt-4 flex items-center text-sm font-medium text-primary">
                Voir les députés
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            {/* Feature 2: Sénateurs */}
            <Link
              href="/senateurs"
              className="group rounded-xl border bg-card p-8 transition-all hover:border-primary hover:shadow-lg"
            >
              <div className="mb-4 inline-flex rounded-lg bg-blue-500/10 p-3">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold">Sénateurs</h3>
              <p className="mt-2 text-muted-foreground">
                Découvrez l&apos;activité des 348 sénateurs de la République.
              </p>
              <div className="mt-4 flex items-center text-sm font-medium text-blue-600">
                Voir les sénateurs
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            {/* Feature 3: Scrutins */}
            <Link
              href="/scrutins"
              className="group rounded-xl border bg-card p-8 transition-all hover:border-primary hover:shadow-lg"
            >
              <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3">
                <Vote className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Scrutins</h3>
              <p className="mt-2 text-muted-foreground">
                Tous les votes de l&apos;Assemblée et du Sénat, par thème.
              </p>
              <div className="mt-4 flex items-center text-sm font-medium text-primary">
                Voir les scrutins
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            {/* Feature 4: Lobbying */}
            <Link
              href="/lobbying"
              className="group rounded-xl border bg-card p-8 transition-all hover:border-primary hover:shadow-lg"
            >
              <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Lobbying</h3>
              <p className="mt-2 text-muted-foreground">
                Qui influence qui ? Les actions déclarées à la HATVP.
              </p>
              <div className="mt-4 flex items-center text-sm font-medium text-primary">
                Explorer le lobbying
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Explorer CTA */}
      <section className="py-16 border-t">
        <div className="container mx-auto px-4">
          <div
            className="block rounded-2xl bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10 p-8 md:p-12 border border-primary/20 opacity-75"
          >
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-shrink-0">
                <div className="inline-flex rounded-xl bg-primary/20 p-4">
                  <BarChart3 className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-2xl font-bold">Explorateur de données</h3>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-primary text-primary-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Beta
                  </span>
                </div>
                <p className="text-muted-foreground text-lg">
                  Analysez les données comme un pro ! Visualisez les tendances de vote,
                  découvrez les députés dissidents, explorez le lobbying par secteur...
                </p>
              </div>
              <div className="flex-shrink-0">
                <span className="inline-flex items-center gap-2 text-muted-foreground font-medium">
                  Arrive prochainement
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-muted/30 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold">Prêt à y voir plus clair ?</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Commencez maintenant et découvrez comment CLAIR peut transformer votre compréhension de la politique française.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/deputes"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Commencer maintenant
            </Link>
            <Link
              href="/a-propos"
              className="inline-flex items-center justify-center rounded-lg border px-6 py-3 font-medium transition-colors hover:bg-accent"
            >
              En savoir plus
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
