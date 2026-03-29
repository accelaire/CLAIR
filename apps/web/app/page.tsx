'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, Calendar, ChevronLeft, ChevronRight, Landmark, Building2, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useCountUp } from '@/hooks/useCountUp';
import { FAQAccordion } from '@/components/ui/faq-accordion';

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
  voteStats: { adopte: number; rejete: number };
}

const formatDossierTitre = (titre: string, procedureLibelle?: string | null): string => {
  const firstChar = titre.charAt(0);
  if (firstChar !== firstChar.toUpperCase() && procedureLibelle) {
    return `${procedureLibelle} ${titre}`;
  }
  return titre;
};

import { DOSSIER_ETAT_CONFIG, getDossierEtat } from '@/lib/dossiers';

const dossierEtatLabels = DOSSIER_ETAT_CONFIG;

const faqItems = [
  {
    question: 'Quel est l\'objectif de CLAIR ?',
    answer: 'La transparence politique est un pilier de la démocratie. Pourtant, les données sur l\'activité de nos élus sont dispersées, difficiles d\'accès et souvent incompréhensibles pour le citoyen lambda.\n\nCLAIR rassemble ces informations publiques en un seul endroit, les structure, et les présente de manière claire et accessible. Notre objectif : permettre à chaque citoyen de comprendre ce que font ses représentants, comment ils votent, et qui cherche à les influencer.',
  },
  {
    question: 'Pourquoi CLAIR plutôt que les sites de l\'Assemblée nationale ou du Sénat ?',
    answer: 'Les sites institutionnels sont des références indispensables, et CLAIR s\'en inspire. Mais chacun se concentre sur sa propre chambre : il faut naviguer entre assemblee-nationale.fr et senat.fr pour suivre un même texte de loi.\n\nCLAIR réunit les données des deux chambres en un seul endroit, et y ajoute les données de lobbying (HATVP). Vous pouvez comparer les votes entre députés et sénateurs, croiser les amendements avec les scrutins, et suivre l\'ensemble du parcours législatif sur une même page.',
  },
  {
    question: 'Ai-je besoin de connaissances poussées sur le parlement pour comprendre ?',
    answer: (<>Pas du tout ! CLAIR a pour vocation de rendre les données parlementaires accessibles au plus grand nombre. Si un terme vous échappe, consultez notre section <Link href="/comprendre" className="text-primary hover:underline">Comprendre</Link> qui explique simplement le fonctionnement des institutions. Et pour apprendre à utiliser la plateforme, suivez notre <Link href="/guide" className="text-primary hover:underline">Guide pratique</Link> pas à pas.</>),
  },
  {
    question: 'D\'où viennent les données qui figurent sur CLAIR ?',
    answer: (<>Toutes nos données proviennent de sources officielles et publiques : l&apos;Assemblée nationale (open data), le Sénat, la Haute Autorité pour la Transparence de la Vie Publique (HATVP) et la Direction de l&apos;Information Légale et Administrative (DILA). Ces données sont disponibles sous Licence Ouverte. Pour en savoir plus, consultez notre page <Link href="/methodologie" className="text-primary hover:underline">Méthodologie</Link>.</>),
  },
  {
    question: 'À quelle fréquence les données sont-elles mises à jour ?',
    answer: 'Les votes, interventions et amendements sont synchronisés quotidiennement. Les données de lobbying (HATVP) sont mises à jour de façon hebdomadaire. Un léger délai de 24 à 48h peut exister entre la publication des données par les sources officielles et leur apparition sur CLAIR.',
  },
  {
    question: 'Qui est derrière le projet CLAIR ?',
    answer: 'CLAIR est un projet citoyen indépendant, entièrement open-source. Il n\'est financé par aucun parti politique, syndicat ou entreprise. Le code source est disponible sur GitHub et les contributions sont les bienvenues.',
  },
];

const statItems = [
  { key: 'deputes', label: 'Députés', href: '/deputes' },
  { key: 'senateurs', label: 'Sénateurs', href: '/senateurs' },
  { key: 'scrutins', label: 'Scrutins', href: '/scrutins' },
  { key: 'dossiers', label: 'Dossiers', href: '/dossiers' },
  { key: 'interventions', label: 'Interventions', href: '/deputes' },
  { key: 'amendements', label: 'Amendements', href: '/scrutins' },
  { key: 'lobbyistes', label: 'Lobbyistes', href: '/lobbying' },
  { key: 'actionsLobby', label: 'Actions lobby', href: '/lobbying' },
] as const;

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: homepageData } = useQuery<{ stats: Stats; trendingDossiers: TrendingDossier[]; lastUpdate: string | null }>({
    queryKey: ['homepage'],
    queryFn: () => api.get('/homepage').then(res => res.data),
    staleTime: 5 * 60 * 1000,   // 5min — données quasi-statiques (cache API = 1h)
    gcTime: 30 * 60 * 1000,     // 30min — garde en mémoire pour éviter une page vide
    refetchOnWindowFocus: false, // pas de refetch au focus (évite les requêtes inutiles)
    retry: 2,                    // retente 2 fois en cas de timeout
  });

  const stats = homepageData?.stats;
  const trendingDossiers = homepageData?.trendingDossiers;

  // Animated counters
  const deputesCount = useCountUp(Math.min(stats?.deputes ?? 0, 577));
  const senateursCount = useCountUp(stats?.senateurs);
  const scrutinsCount = useCountUp(stats?.scrutins);
  const dossiersCount = useCountUp(stats?.dossiers);
  const lobbyistesCount = useCountUp(stats?.lobbyistes);
  const actionsCount = useCountUp(stats?.actionsLobby);
  const interventionsCount = useCountUp(stats?.interventions);
  const amendementsCount = useCountUp(stats?.amendements);

  const formatStat = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
    return n.toLocaleString('fr-FR');
  };

  const counters: Record<string, number> = {
    deputes: deputesCount,
    senateurs: senateursCount,
    scrutins: scrutinsCount,
    dossiers: dossiersCount,
    interventions: interventionsCount,
    amendements: amendementsCount,
    lobbyistes: lobbyistesCount,
    actionsLobby: actionsCount,
  };

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
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              La politique française,{' '}
              <span className="text-primary">en clair</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              Consultez les votes des députés et sénateurs, suivez le lobbying et explorez les dossiers législatifs.
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
                  placeholder="Rechercher un député, un scrutin..."
                  className="w-full rounded-xl border bg-background pl-12 pr-32 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Rechercher
                </button>
              </div>
            </form>

            {/* Stats Cards — auto-scroll + swipeable carousel with edge blur */}
            <div
              className="mt-12 overflow-x-auto overflow-y-hidden scrollbar-none touch-pan-x"
              style={{
                maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
                WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
              }}
            >
              <div className="flex gap-4 w-max animate-stats-scroll hover:[animation-play-state:paused] py-1">
                {[...statItems, ...statItems].map((item, index) => (
                  <Link
                    key={`${item.key}-${index}`}
                    href={item.href}
                    className="w-[150px] rounded-xl bg-primary-accent px-5 py-4 text-white transition-colors hover:bg-primary-deep flex flex-col items-center text-center flex-shrink-0"
                  >
                    <span className="text-2xl font-bold tabular-nums">
                      {stats?.[item.key] ? formatStat(counters[item.key]) : '—'}
                    </span>
                    <span className="text-sm text-white/80 mt-0.5">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Dernière mise à jour */}
            {homepageData?.lastUpdate && (
              <p className="mt-4 text-center text-xs italic text-muted-foreground">
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

      {/* Derniers dossiers législatifs discutés */}
      {trendingDossiers && trendingDossiers.length > 0 && (
        <section className="py-16 overflow-hidden">
          <div className="container mx-auto px-4">
            <div className="mb-8">
              <span className="text-sm font-medium text-primary">Actualités</span>
              <div className="flex items-center justify-between mt-1">
                <div>
                  <h2 className="text-2xl font-bold">Derniers dossiers législatifs discutés</h2>
                  <p className="text-muted-foreground mt-1">Quelques-uns des derniers dossiers abordés au Parlement</p>
                </div>
                <Link
                  href="/dossiers"
                  className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Voir tous les dossiers
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
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
              className="overflow-x-auto pb-4 px-4 md:px-[max(1rem,calc((100%-768px)/2+1rem))] lg:px-[max(1rem,calc((100%-1024px)/2+1rem))] xl:px-[max(1rem,calc((100%-1280px)/2+1rem))] scrollbar-none"
            >
              <div className="flex gap-4 w-max animate-carousel-scroll group-hover:[animation-play-state:paused]">
                {[...trendingDossiers, ...trendingDossiers].map((dossier, index) => (
                  <Link
                    key={`${dossier.id}-${index}`}
                    href={`/dossiers/${dossier.uid}`}
                    className="w-[400px] flex-shrink-0 rounded-xl border bg-card p-5 transition-all hover:border-primary hover:shadow-md flex flex-col"
                  >
                    {/* Header: chambre + etat */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2.5 py-1 rounded-md border text-xs font-medium ${dossier.chambre === 'senat' ? 'badge-senat' : 'badge-assemblee'}`}>
                        {dossier.chambre === 'senat' ? 'Sénat' : 'Assemblée'}
                      </span>
                      {dossier.etat && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium">
                          <span className={`h-2 w-2 rounded-full ${getDossierEtat(dossier.etat)?.dotColor ?? 'bg-muted-foreground'}`} />
                          {dossierEtatLabels[dossier.etat]?.label || dossier.etat}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold text-base line-clamp-2 mb-1">{formatDossierTitre(dossier.titre, dossier.procedureLibelle)}</h3>

                    {/* Description — truncated titre for extra context */}
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-auto">
                      {dossier.procedureLibelle || dossier.titre}
                    </p>

                    {/* Footer: last vote date + scrutins count */}
                    <div className="mt-4 pt-3 flex items-center gap-4 text-sm text-muted-foreground">
                      {dossier.lastScrutinDate && (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          Dernier vote : {formatDate(dossier.lastScrutinDate)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <span className="font-medium text-muted-foreground">#</span>
                        {dossier.scrutinsCount} scrutin{dossier.scrutinsCount > 1 ? 's' : ''}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile CTA — visible only on small screens */}
          <div className="container mx-auto px-4 mt-4 sm:hidden">
            <Link
              href="/dossiers"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Voir tous les dossiers
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      {/* Open Source Banner — edge-to-edge */}
      <section className="bg-primary-deep py-12 md:py-16 text-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center gap-8">
            <div className="flex-1">
              <h3 className="text-2xl md:text-3xl font-bold">
                CLAIR est un projet 100% open-source
              </h3>
              <p className="mt-3 text-white/80">
                Le code est disponible sur GitHub et les contributions sont les bienvenues. Que
                vous soyez développeur, designer, data analyst ou simplement citoyen engagé,
                vous pouvez participer.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start gap-3 md:flex-shrink-0">
              <Link
                href="/methodologie"
                className="inline-flex items-center gap-2 rounded-lg bg-white/90 dark:bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-white"
              >
                Voir la méthodologie
              </Link>
              <a
                href="https://github.com/accelaire/CLAIR"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
              >
                Voir sur Github
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div>
            <span className="text-sm font-medium text-primary">À quoi sert CLAIR ?</span>
            <h2 className="mt-2 text-3xl font-bold">
              Consultez les votes, facilement
            </h2>
            <p className="mt-4 max-w-2xl text-muted-foreground">
              Fini les données dispersées et les interfaces illisibles.
              CLAIR agrège et simplifie l&apos;information politique pour vous.
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1: Députés */}
            <Link
              href="/deputes"
              className="group rounded-2xl p-8 transition-all bg-muted/50"
            >
              <div className="mb-4 inline-flex rounded-xl bg-primary p-3">
                <Landmark className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold">Députés</h3>
              <p className="mt-2 text-muted-foreground">
                Votes, présence, loyauté au groupe... Tout savoir sur votre député.
              </p>
              <div className="mt-4 flex items-center text-sm font-medium text-primary">
                Trouver un député
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            {/* Feature 2: Sénateurs */}
            <Link
              href="/senateurs"
              className="group rounded-2xl p-8 transition-all bg-muted/50"
            >
              <div className="mb-4 inline-flex rounded-xl bg-primary p-3">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold">Sénateurs</h3>
              <p className="mt-2 text-muted-foreground">
                Découvrez l&apos;activité des 348 sénateurs de la République.
              </p>
              <div className="mt-4 flex items-center text-sm font-medium text-primary">
                Trouver un sénateur
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            {/* Feature 3: Groupes parlementaires */}
            <Link
              href="/groupes"
              className="group rounded-2xl p-8 transition-all bg-muted/50"
            >
              <div className="mb-4 inline-flex rounded-xl bg-primary p-3">
                <Users className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold">Groupes parlementaires</h3>
              <p className="mt-2 text-muted-foreground">
                Explorez les groupes politiques de l&apos;Assemblée et du Sénat.
              </p>
              <div className="mt-4 flex items-center text-sm font-medium text-primary">
                Trouver un groupe
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <hr className="border-border mb-20" />
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-bold">Questions fréquentes</h2>
            <p className="mt-4 text-center text-muted-foreground">
              Si la vôtre n&apos;y figure pas, contactez-nous directement à{' '}
              <a href="mailto:contact@clair.vote" className="text-foreground underline hover:text-primary">
                contact@clair.vote
              </a>
            </p>
            <div className="mt-10">
              <FAQAccordion items={faqItems} defaultOpenIndex={0} />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Donation */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="rounded-2xl bg-primary-deep p-8 md:p-12 text-white">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-1">
                <h2 className="text-2xl md:text-3xl font-bold">Soutenez l&apos;indépendance de CLAIR</h2>
                <p className="mt-3 text-white/80">
                  CLAIR est un projet 100% citoyen, sans publicité ni financement politique. Votre
                  don nous permet de rester indépendants.
                </p>
              </div>
              <div className="md:flex-shrink-0">
                <Link
                  href="/soutenir"
                  className="inline-flex items-center justify-center rounded-lg bg-white/90 dark:bg-white px-6 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-white"
                >
                  Faire un don
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
