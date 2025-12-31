'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Users, Vote, Building2, ArrowRight, CheckCircle, XCircle, Calendar, BarChart3, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';

interface Stats {
  deputes: number;
  senateurs: number;
  scrutins: number;
  lobbyistes: number;
  actionsLobby: number;
}

interface RecentScrutin {
  id: string;
  numero: number;
  chambre: string;
  date: string;
  titre: string;
  sort: string;
  nombrePour: number;
  nombreContre: number;
  importance: number;
}

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch stats
  const { data: stats } = useQuery<Stats>({
    queryKey: ['home-stats'],
    queryFn: async () => {
      const [deputesRes, senateursRes, scrutinsRes, lobbyingRes] = await Promise.all([
        api.get('/deputes', { params: { limit: 1 } }),
        api.get('/senateurs', { params: { limit: 1 } }),
        api.get('/scrutins', { params: { limit: 1 } }),
        api.get('/lobbying/stats'),
      ]);
      return {
        deputes: deputesRes.data.meta.total,
        senateurs: senateursRes.data.meta.total,
        scrutins: scrutinsRes.data.meta.total,
        lobbyistes: lobbyingRes.data.data.totalLobbyistes,
        actionsLobby: lobbyingRes.data.data.totalActions,
      };
    },
    staleTime: 60000,
  });

  // Fetch recent important scrutins
  const { data: recentScrutins } = useQuery<{ data: RecentScrutin[] }>({
    queryKey: ['home-recent-scrutins'],
    queryFn: () => api.get('/scrutins/importants', { params: { limit: 5 } }).then(res => res.data),
    staleTime: 60000,
  });

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

            {/* Quick Stats */}
            <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-5">
              <div className="rounded-lg border bg-card p-4">
                <div className="text-2xl font-bold text-primary">
                  {stats?.deputes || '577'}
                </div>
                <div className="text-sm text-muted-foreground">Députés</div>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <div className="text-2xl font-bold text-primary">
                  {stats?.senateurs || '348'}
                </div>
                <div className="text-sm text-muted-foreground">Sénateurs</div>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <div className="text-2xl font-bold text-primary">
                  {stats?.scrutins?.toLocaleString('fr-FR') || '—'}
                </div>
                <div className="text-sm text-muted-foreground">Scrutins</div>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <div className="text-2xl font-bold text-primary">
                  {stats?.lobbyistes?.toLocaleString('fr-FR') || '—'}
                </div>
                <div className="text-sm text-muted-foreground">Lobbyistes</div>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <div className="text-2xl font-bold text-primary">
                  {stats?.actionsLobby?.toLocaleString('fr-FR') || '—'}
                </div>
                <div className="text-sm text-muted-foreground">Actions lobby</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Important Votes */}
      {recentScrutins?.data && recentScrutins.data.length > 0 && (
        <section className="py-16 border-b">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">Scrutins importants récents</h2>
              <Link
                href="/scrutins"
                className="flex items-center text-sm font-medium text-primary hover:underline"
              >
                Voir tous les scrutins
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recentScrutins.data.slice(0, 6).map((scrutin) => (
                <Link
                  key={scrutin.id}
                  href={`/scrutins/${scrutin.numero}?chambre=${scrutin.chambre || 'assemblee'}`}
                  className="rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
                >
                  <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {formatDate(scrutin.date)}
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      scrutin.chambre === 'senat'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {scrutin.chambre === 'senat' ? 'Sénat' : 'AN'}
                    </span>
                    <span className={`ml-auto px-2 py-0.5 rounded text-xs font-medium ${
                      scrutin.sort === 'adopte'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {scrutin.sort === 'adopte' ? 'Adopté' : 'Rejeté'}
                    </span>
                  </div>
                  <h3 className="font-medium line-clamp-2 mb-2">{scrutin.titre}</h3>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      {scrutin.nombrePour}
                    </span>
                    <span className="flex items-center gap-1 text-red-600">
                      <XCircle className="h-4 w-4" />
                      {scrutin.nombreContre}
                    </span>
                  </div>
                </Link>
              ))}
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
          <Link
            href="/explorateur"
            className="group block rounded-2xl bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10 p-8 md:p-12 transition-all hover:shadow-xl border border-primary/20 hover:border-primary/40"
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
                <span className="inline-flex items-center gap-2 text-primary font-medium group-hover:gap-3 transition-all">
                  Explorer maintenant
                  <ArrowRight className="h-5 w-5" />
                </span>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-muted/30 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold">Prêt à y voir plus clair ?</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Créez un compte gratuit pour recevoir des alertes sur les votes de vos parlementaires
            et sauvegarder vos recherches.
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
