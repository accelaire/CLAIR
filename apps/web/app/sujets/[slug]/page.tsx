'use client';

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Calendar,
  Hash,
  ChevronLeft,
  ExternalLink,
  CheckCircle,
  XCircle,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

interface Sujet {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  category: string | null;
  memberCount: number;
  dateDebut: string | null;
  dateFin: string | null;
  featured: boolean;
  usefulLinks: Array<{ title: string; url: string }>;
  newsUrl: string | null;
}

interface Scrutin {
  id: string;
  numero: number;
  chambre: string;
  session: string;
  date: string;
  titre: string;
  sort: string;
  typeVote: string;
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
  importance: number;
  tags: string[];
  similarity: number | null;
  auto: boolean;
}

interface ScrutinsResponse {
  data: Scrutin[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
  };
}

interface GroupeStats {
  nom: string;
  slug: string;
  couleur: string;
  votes: {
    pour: number;
    contre: number;
    abstention: number;
    absent: number;
  };
}

const categoryLabels: Record<string, { label: string; color: string }> = {
  budget: { label: 'Budget', color: 'bg-emerald-100 text-emerald-700' },
  sante: { label: 'Santé', color: 'bg-red-100 text-red-700' },
  securite: { label: 'Sécurité', color: 'bg-orange-100 text-orange-700' },
  immigration: { label: 'Immigration', color: 'bg-amber-100 text-amber-700' },
  environnement: { label: 'Environnement', color: 'bg-green-100 text-green-700' },
  travail: { label: 'Travail', color: 'bg-blue-100 text-blue-700' },
  education: { label: 'Éducation', color: 'bg-purple-100 text-purple-700' },
  justice: { label: 'Justice', color: 'bg-slate-100 text-slate-700' },
  institutions: { label: 'Institutions', color: 'bg-indigo-100 text-indigo-700' },
  europe: { label: 'Europe', color: 'bg-blue-100 text-blue-700' },
  international: { label: 'International', color: 'bg-cyan-100 text-cyan-700' },
  agriculture: { label: 'Agriculture', color: 'bg-lime-100 text-lime-700' },
  logement: { label: 'Logement', color: 'bg-yellow-100 text-yellow-700' },
  transports: { label: 'Transports', color: 'bg-teal-100 text-teal-700' },
  culture: { label: 'Culture', color: 'bg-pink-100 text-pink-700' },
  autre: { label: 'Autre', color: 'bg-gray-100 text-gray-700' },
};

const sortLabels: Record<string, { label: string; color: string }> = {
  adopte: { label: 'Adopté', color: 'text-green-600 bg-green-100' },
  rejete: { label: 'Rejeté', color: 'text-red-600 bg-red-100' },
};

const chambreLabels: Record<string, string> = {
  assemblee: 'AN',
  senat: 'Sénat',
};

export default function SujetDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  // Fetch sujet detail
  const { data: sujetData, isLoading: sujetLoading, error: sujetError } = useQuery({
    queryKey: ['sujet', slug],
    queryFn: () => api.get(`/sujets/${slug}`).then((res) => res.data.data as Sujet),
    enabled: !!slug,
  });

  // Fetch scrutins
  const {
    data: scrutinsData,
    isLoading: scrutinsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<ScrutinsResponse>({
    queryKey: ['sujet-scrutins', slug],
    queryFn: ({ pageParam = 1 }) =>
      api.get(`/sujets/${slug}/scrutins`, {
        params: { page: pageParam, limit: 20 },
      }).then((res) => res.data),
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
    enabled: !!slug,
  });

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['sujet-stats', slug],
    queryFn: () => api.get(`/sujets/${slug}/stats`).then((res) => res.data.data as GroupeStats[]),
    enabled: !!slug,
  });

  const { loadMoreRef } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  const scrutins = scrutinsData?.pages.flatMap((page) => page.data) ?? [];
  const total = scrutinsData?.pages[0]?.meta.total ?? 0;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatShortDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      month: 'short',
      year: 'numeric',
    });
  };

  // Loading
  if (sujetLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 w-1/3 rounded bg-muted mb-4" />
          <div className="h-6 w-2/3 rounded bg-muted mb-8" />
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-card p-4">
                <div className="h-5 w-3/4 rounded bg-muted mb-2" />
                <div className="h-4 w-1/2 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error
  if (sujetError || !sujetData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Sujet non trouvé
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        href="/sujets"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="h-4 w-4" />
        Tous les sujets
      </Link>

      {/* Header */}
      <div className="mb-8">
        {sujetData.category && (
          <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded mb-3 ${categoryLabels[sujetData.category]?.color || 'bg-gray-100 text-gray-700'}`}>
            {categoryLabels[sujetData.category]?.label || sujetData.category}
          </span>
        )}

        <h1 className="text-3xl font-bold mb-2">{sujetData.label}</h1>

        {sujetData.description && (
          <p className="text-lg text-muted-foreground mb-4">
            {sujetData.description}
          </p>
        )}

        {/* Meta infos */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Hash className="h-4 w-4" />
            {sujetData.memberCount} scrutin{sujetData.memberCount > 1 ? 's' : ''}
          </span>
          {sujetData.dateDebut && sujetData.dateFin && (
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatShortDate(sujetData.dateDebut)} - {formatShortDate(sujetData.dateFin)}
            </span>
          )}
        </div>

        {/* Liens utiles */}
        {(sujetData.usefulLinks?.length > 0 || sujetData.newsUrl) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {sujetData.newsUrl && (
              <a
                href={sujetData.newsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Actualités
              </a>
            )}
            {sujetData.usefulLinks?.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {link.title}
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Stats par groupe */}
        {statsData && statsData.length > 0 && (
          <div className="lg:col-span-1">
            <h2 className="text-xl font-semibold mb-4">Votes par groupe</h2>
            <div className="space-y-3">
              {statsData.map((groupe) => {
                const total = groupe.votes.pour + groupe.votes.contre + groupe.votes.abstention;
                if (total === 0) return null;

                const pourPercent = (groupe.votes.pour / total) * 100;
                const contrePercent = (groupe.votes.contre / total) * 100;
                const abstentionPercent = (groupe.votes.abstention / total) * 100;

                return (
                  <div key={groupe.slug} className="rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: groupe.couleur }}
                      />
                      <span className="font-medium text-sm">{groupe.nom}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden flex bg-muted">
                      <div
                        className="bg-green-500"
                        style={{ width: `${pourPercent}%` }}
                      />
                      <div
                        className="bg-red-500"
                        style={{ width: `${contrePercent}%` }}
                      />
                      <div
                        className="bg-gray-400"
                        style={{ width: `${abstentionPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span className="text-green-600">{groupe.votes.pour} pour</span>
                      <span className="text-red-600">{groupe.votes.contre} contre</span>
                      <span>{groupe.votes.abstention} abs.</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Liste des scrutins */}
        <div className={statsData && statsData.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <h2 className="text-xl font-semibold mb-4">
            Scrutins ({total})
          </h2>

          {scrutinsLoading && (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
                  <div className="h-5 w-3/4 rounded bg-muted mb-2" />
                  <div className="h-4 w-1/2 rounded bg-muted" />
                </div>
              ))}
            </div>
          )}

          {scrutins.length > 0 && (
            <div className="space-y-3">
              {scrutins.map((scrutin) => (
                <Link
                  key={scrutin.id}
                  href={`/scrutins/${scrutin.numero}?chambre=${scrutin.chambre || 'assemblee'}${scrutin.chambre === 'senat' && scrutin.session ? `&session=${scrutin.session}` : ''}`}
                  className="block rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-medium text-muted-foreground">
                          n°{scrutin.numero}
                        </span>
                        <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${scrutin.chambre === 'senat' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {chambreLabels[scrutin.chambre] || 'AN'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(scrutin.date)}
                        </span>
                      </div>
                      <h3 className="font-medium text-sm leading-tight line-clamp-2">
                        {scrutin.titre}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="flex items-center gap-0.5 text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          {scrutin.nombrePour}
                        </span>
                        <span className="flex items-center gap-0.5 text-red-600">
                          <XCircle className="h-3 w-3" />
                          {scrutin.nombreContre}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${sortLabels[scrutin.sort]?.color || 'bg-muted text-muted-foreground'}`}>
                        {sortLabels[scrutin.sort]?.label || scrutin.sort}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}

              {/* Infinite scroll trigger */}
              <div ref={loadMoreRef} className="mt-4 flex justify-center py-2">
                {isFetchingNextPage && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Chargement...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {!scrutinsLoading && scrutins.length === 0 && (
            <p className="text-muted-foreground">Aucun scrutin associé à ce sujet</p>
          )}
        </div>
      </div>
    </div>
  );
}
