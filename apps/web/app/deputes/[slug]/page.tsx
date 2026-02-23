'use client';

import { useState } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Users,
  MapPin,
  Calendar,
  Briefcase,
  Twitter,
  Mail,
  Globe,
  TrendingUp,
  Vote,
  MessageSquare,
  FileText,
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Loader2,
  GitCompareArrows,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { DateRangePicker, dateRangeToParams } from '@/components/DateRangePicker';
import { useUrlDateRange } from '@/hooks/useUrlFilters';

interface DeputeDetail {
  id: string;
  slug: string;
  nom: string;
  prenom: string;
  sexe: string | null;
  dateNaissance: string | null;
  profession: string | null;
  photoUrl: string | null;
  twitter: string | null;
  email: string | null;
  siteWeb: string | null;
  groupe: {
    slug: string;
    nom: string;
    nomComplet: string | null;
    couleur: string | null;
  } | null;
  circonscription: {
    departement: string;
    numero: number;
    nom: string;
  } | null;
  stats?: {
    presence: number;
    presenceSolennel: number | null;
    loyaute: number;
    participation: number;
    interventions: number;
    amendements: { proposes: number; adoptes: number };
    questions: number;
  };
}

interface VoteItem {
  id: string;
  position: string;
  groupePosition: string | null;
  scrutin: {
    id: string;
    numero: number;
    date: string;
    titre: string;
    sort: string;
    typeVote: string;
    tags: string[];
    importance: number;
    nombrePour: number;
    nombreContre: number;
    nombreAbstention: number;
  };
}

function StatCard({
  label,
  value,
  icon: Icon,
  suffix = '',
  subtitle,
}: {
  label: string;
  value: number | string | null;
  icon: any;
  suffix?: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl font-bold">
          {value !== null ? `${typeof value === 'number' ? value.toLocaleString('fr-FR') : value}${suffix}` : 'N/A'}
        </span>
        {subtitle && (
          <span className="text-sm text-muted-foreground">{subtitle}</span>
        )}
      </div>
    </div>
  );
}

function VotePositionBadge({ position }: { position: string }) {
  const config = {
    pour: { label: 'Pour', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100', icon: ThumbsUp },
    contre: { label: 'Contre', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100', icon: ThumbsDown },
    abstention: { label: 'Abstention', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100', icon: Minus },
    absent: { label: 'Absent', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100', icon: Minus },
  }[position] || { label: position, className: 'bg-gray-100 text-gray-800', icon: Minus };

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

interface InterventionItem {
  id: string;
  date: string;
  type: string;
  contenu: string;
  motsCles: string[];
  sourceUrl: string | null;
  ordre: number | null;
  scrutin: {
    id: string;
    numero: number;
    titre: string;
    date: string;
    sort: string;
  } | null;
}

function InterventionsList({ slug }: { slug: string }) {
  const [dateRange, setDateRange] = useUrlDateRange();
  const dateParams = dateRangeToParams(dateRange);

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['depute-interventions', slug, dateParams],
    queryFn: ({ pageParam = 1 }) =>
      api.get(`/deputes/${slug}/interventions`, {
        params: {
          page: pageParam,
          limit: 20,
          ...dateParams,
        },
      }).then((res) => res.data),
    getNextPageParam: (lastPage) =>
      lastPage.meta?.hasNext ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
    enabled: !!slug,
  });

  const { loadMoreRef } = useInfiniteScroll({
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  const interventions = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className="space-y-4">
      <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Filtrer par période" />

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border p-4">
              <div className="h-4 w-1/4 rounded bg-muted" />
              <div className="mt-2 h-20 w-full rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : error || interventions.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          Aucune intervention trouvée pour cette période.
        </p>
      ) : (
        <div className="space-y-4">
          {interventions.map((intervention: InterventionItem) => (
        <div
          key={intervention.id}
          className="rounded-lg border bg-card p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {new Date(intervention.date).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">
              {intervention.type.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm leading-relaxed line-clamp-4">
            {intervention.contenu}
          </p>
          {intervention.motsCles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {intervention.motsCles.map((tag) => (
                <span key={tag} className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {/* Lien vers le scrutin associé */}
          {intervention.scrutin && (
            <div className="mt-2">
              <Link
                href={`/scrutins/${intervention.scrutin.numero}`}
                className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:underline bg-indigo-50 px-2 py-1 rounded"
              >
                <Vote className="h-3 w-3" />
                Scrutin n°{intervention.scrutin.numero}
                <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  intervention.scrutin.sort === 'adopte' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {intervention.scrutin.sort === 'adopte' ? 'Adopté' : 'Rejeté'}
                </span>
              </Link>
            </div>
          )}
        </div>
          ))}

          {/* Sentinel pour le scroll infini */}
          <div ref={loadMoreRef} className="h-4" />

          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface AmendementItem {
  id: string;
  uid: string;
  numero: string;
  legislature: number;
  texteRef: string | null;
  articleVise: string | null;
  dispositif: string | null;
  exposeSommaire: string | null;
  auteurLibelle: string | null;
  sort: string | null;
  dateDepot: string | null;
  dateSort: string | null;
  scrutins: Array<{
    id: string;
    numero: number;
    titre: string;
    date: string;
    sort: string;
  }>;
  dossier: {
    uid: string;
    titre: string;
    titreCourt: string | null;
  } | null;
}

/** Formate un titreCourt slug-like en texte lisible, sinon fallback sur titre */
function formatDossierLabel(dossier: { titre: string; titreCourt: string | null }): string {
  const short = dossier.titreCourt;
  if (!short) return dossier.titre;
  // UID technique → fallback titre
  if (/^[A-Z0-9]{5,}/.test(short)) return dossier.titre;
  // Slug avec underscores → humanize
  if (short.includes('_')) {
    const humanized = short.replace(/_/g, ' ').replace(/\d+e?$/, '').trim();
    return humanized.charAt(0).toUpperCase() + humanized.slice(1);
  }
  return short;
}

function AmendementSortBadge({ sort }: { sort: string | null }) {
  if (!sort) return null;

  const sortLower = sort.toLowerCase();
  let className = 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';

  if (sortLower.includes('adopt')) {
    className = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
  } else if (sortLower.includes('rejet')) {
    className = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
  } else if (sortLower.includes('retir')) {
    className = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100';
  } else if (sortLower.includes('tomb') || sortLower.includes('entonnoir')) {
    className = 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100';
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {sort}
    </span>
  );
}

function ExpandableAmendementCard({ amendement }: { amendement: AmendementItem }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasLongContent =
    (amendement.exposeSommaire && amendement.exposeSommaire.length > 200) ||
    amendement.dispositif;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-sm font-medium">
              {amendement.numero}
            </span>
            {amendement.articleVise && (
              <span className="text-sm text-muted-foreground">
                • {amendement.articleVise}
              </span>
            )}
          </div>

          {/* Exposé sommaire */}
          {amendement.exposeSommaire && (
            <div className="mb-2">
              <p className={`text-sm leading-relaxed ${!isExpanded ? 'line-clamp-3' : ''}`}>
                {amendement.exposeSommaire}
              </p>
            </div>
          )}

          {/* Dispositif (visible uniquement si expanded) */}
          {isExpanded && amendement.dispositif && (
            <div className="mt-3 rounded bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Dispositif :</p>
              <p className="text-sm leading-relaxed">{amendement.dispositif}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-2">
            {amendement.dateDepot && (
              <span>
                Déposé le {new Date(amendement.dateDepot).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            )}
            {amendement.texteRef && (
              <>
                <span>•</span>
                <span className="font-mono">{amendement.texteRef}</span>
              </>
            )}
          </div>

          {/* Liens vers le dossier et/ou le scrutin */}
          {(amendement.dossier || (amendement.scrutins && amendement.scrutins.length > 0)) && (
            <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">
              {amendement.dossier && (
                <Link
                  href={`/dossiers/${amendement.dossier.uid}`}
                  className="inline-flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 hover:underline bg-blue-50 px-3 py-1.5 rounded-md transition-colors"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="line-clamp-1">{formatDossierLabel(amendement.dossier)}</span>
                </Link>
              )}
              {amendement.scrutins && amendement.scrutins.length > 0 && (
                <Link
                  href={`/scrutins/${amendement.scrutins[0].numero}`}
                  className="inline-flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-800 hover:underline bg-indigo-50 px-3 py-1.5 rounded-md transition-colors"
                >
                  <Vote className="h-3.5 w-3.5" />
                  <span>Vote n°{amendement.scrutins[0].numero}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    amendement.scrutins[0].sort === 'adopte' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {amendement.scrutins[0].sort === 'adopte' ? 'Adopté' : 'Rejeté'}
                  </span>
                </Link>
              )}
            </div>
          )}
        </div>
        <AmendementSortBadge sort={amendement.sort} />
      </div>

      {/* Bouton expand/collapse */}
      {hasLongContent && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Réduire
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Voir plus
            </>
          )}
        </button>
      )}
    </div>
  );
}

function AmendementsList({ slug }: { slug: string }) {
  const [dateRange, setDateRange] = useUrlDateRange();
  const [votedOnly, setVotedOnly] = useState(false);
  const dateParams = dateRangeToParams(dateRange);

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['depute-amendements', slug, dateParams, votedOnly],
    queryFn: ({ pageParam = 1 }) =>
      api.get(`/deputes/${slug}/amendements`, {
        params: {
          page: pageParam,
          limit: 20,
          votedOnly,
          ...dateParams,
        },
      }).then((res) => res.data),
    getNextPageParam: (lastPage) =>
      lastPage.meta?.hasNext ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
    enabled: !!slug,
  });

  const { loadMoreRef } = useInfiniteScroll({
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  const amendements = data?.pages.flatMap((page) => page.data) ?? [];
  const total = data?.pages[0]?.meta?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Filtrer par période" />
        <button
          onClick={() => setVotedOnly(!votedOnly)}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            votedOnly
              ? 'bg-indigo-100 border-indigo-300 text-indigo-700 hover:bg-indigo-200'
              : 'bg-background border-input hover:bg-accent'
          }`}
        >
          <Vote className={`h-4 w-4 ${votedOnly ? 'text-indigo-600' : 'text-muted-foreground'}`} />
          Votés individuellement
          {votedOnly && total > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-indigo-200 text-indigo-800 text-xs">
              {total.toLocaleString('fr-FR')}
            </span>
          )}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border p-4">
              <div className="h-4 w-1/3 rounded bg-muted" />
              <div className="mt-2 h-16 w-full rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : error || amendements.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          Aucun amendement trouvé pour cette période.
        </p>
      ) : (
        <div className="space-y-4">
          {amendements.map((amendement: AmendementItem) => (
            <ExpandableAmendementCard key={amendement.id} amendement={amendement} />
          ))}

          {/* Sentinel pour le scroll infini */}
          <div ref={loadMoreRef} className="h-4" />

          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VotesList({ slug }: { slug: string }) {
  const [dateRange, setDateRange] = useUrlDateRange();
  const [dissidentOnly, setDissidentOnly] = useState(false);
  const dateParams = dateRangeToParams(dateRange);

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['depute-votes', slug, dateParams, dissidentOnly],
    queryFn: ({ pageParam = 1 }) =>
      api.get(`/deputes/${slug}/votes`, {
        params: {
          page: pageParam,
          limit: 20,
          dissidentOnly,
          ...dateParams,
        },
      }).then((res) => res.data),
    getNextPageParam: (lastPage) =>
      lastPage.meta?.hasNext ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
    enabled: !!slug,
  });

  const { loadMoreRef } = useInfiniteScroll({
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  const votes = data?.pages.flatMap((page) => page.data) ?? [];
  const total = data?.pages[0]?.meta?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Filtrer par période" />
        <button
          onClick={() => setDissidentOnly(!dissidentOnly)}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            dissidentOnly
              ? 'bg-orange-100 border-orange-300 text-orange-700 hover:bg-orange-200'
              : 'bg-background border-input hover:bg-accent'
          }`}
        >
          <AlertTriangle className={`h-4 w-4 ${dissidentOnly ? 'text-orange-600' : 'text-muted-foreground'}`} />
          Votes dissidents
          {dissidentOnly && total > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-orange-200 text-orange-800 text-xs">
              {total.toLocaleString('fr-FR')}
            </span>
          )}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border p-4">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="mt-2 h-3 w-1/4 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : error || votes.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          Aucun vote trouvé pour cette période.
        </p>
      ) : (
        <div className="space-y-3">
      {votes.map((vote: VoteItem) => {
        const isDissident = vote.groupePosition && vote.position !== vote.groupePosition && vote.position !== 'absent';
        return (
          <Link
            key={vote.id}
            href={`/scrutins/${vote.scrutin.numero}`}
            className={`block rounded-lg border bg-card p-4 transition-colors hover:bg-accent ${
              isDissident ? 'border-orange-200 bg-orange-50/50' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium line-clamp-2">{vote.scrutin.titre}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    {new Date(vote.scrutin.date).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span>•</span>
                  <span className={vote.scrutin.sort === 'adopte' ? 'text-green-600' : 'text-red-600'}>
                    {vote.scrutin.sort === 'adopte' ? 'Adopté' : 'Rejeté'}
                  </span>
                  {vote.scrutin.tags.length > 0 && (
                    <>
                      <span>•</span>
                      {vote.scrutin.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {tag}
                        </span>
                      ))}
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <VotePositionBadge position={vote.position} />
                {isDissident && vote.groupePosition && (
                  <span className="text-xs text-orange-600 font-medium">
                    Groupe: {vote.groupePosition === 'pour' ? 'Pour' : vote.groupePosition === 'contre' ? 'Contre' : 'Abstention'}
                  </span>
                )}
              </div>
            </div>
          </Link>
        );
      })}

          {/* Sentinel pour le scroll infini */}
          <div ref={loadMoreRef} className="h-4" />

          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DeputeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [activeTab, setActiveTab] = useState<'votes' | 'interventions' | 'amendements'>('votes');

  const { data, isLoading, error } = useQuery({
    queryKey: ['depute', slug],
    queryFn: () =>
      api
        .get(`/deputes/${slug}`, { params: { include: 'stats' } })
        .then((res) => res.data.data as DeputeDetail),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-8">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="flex gap-8">
            <div className="h-48 w-48 rounded-full bg-muted" />
            <div className="flex-1 space-y-4">
              <div className="h-8 w-64 rounded bg-muted" />
              <div className="h-4 w-48 rounded bg-muted" />
              <div className="h-4 w-32 rounded bg-muted" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-8 text-center">
          <h2 className="text-xl font-semibold text-destructive">
            Député non trouvé
          </h2>
          <p className="mt-2 text-muted-foreground">
            Ce député n&apos;existe pas ou a été supprimé.
          </p>
          <Link
            href="/deputes"
            className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la liste
          </Link>
        </div>
      </div>
    );
  }

  const depute = data;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb + Action */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center justify-center rounded-lg p-1.5 hover:bg-muted transition-colors flex-shrink-0"
            aria-label="Retour"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Link href="/deputes" className="hover:text-foreground transition-colors flex-shrink-0">Députés</Link>
          <span className="flex-shrink-0">/</span>
          <span className="text-foreground font-medium truncate">{depute.prenom} {depute.nom}</span>
        </nav>

        {/* Bouton Comparer */}
        <Link
          href={`/deputes?compare=${depute.slug}`}
          className="inline-flex items-center gap-2 rounded-lg border-2 border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 hover:border-primary/40 transition-colors flex-shrink-0 self-start sm:self-auto"
        >
          <GitCompareArrows className="h-4 w-4" />
          <span>Comparer avec un autre député</span>
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8 flex flex-col gap-8 md:flex-row">
        {/* Photo */}
        <div className="relative h-48 w-48 flex-shrink-0 overflow-hidden rounded-full bg-muted mx-auto md:mx-0">
          {depute.photoUrl ? (
            <Image
              src={depute.photoUrl}
              alt={`${depute.prenom} ${depute.nom}`}
              fill
              className="object-cover"
              priority
              unoptimized
            />
          ) : (
            <Users className="absolute inset-0 m-auto h-16 w-16 text-muted-foreground" />
          )}
        </div>

        {/* Infos */}
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-3xl font-bold">
            {depute.prenom} {depute.nom}
          </h1>

          {/* Groupe */}
          {depute.groupe && (
            <Link
              href={`/groupes/assemblee/${depute.groupe.slug}`}
              className="mt-2 flex items-center justify-center gap-2 md:justify-start hover:underline transition-colors"
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: depute.groupe.couleur || '#888' }}
              />
              <span className="text-lg">{depute.groupe.nomComplet || depute.groupe.nom}</span>
            </Link>
          )}

          {/* Infos secondaires */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-muted-foreground md:justify-start">
            {depute.circonscription && (
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>
                  {depute.circonscription.nom} ({depute.circonscription.departement})
                </span>
              </div>
            )}
            {depute.profession && (
              <div className="flex items-center gap-1">
                <Briefcase className="h-4 w-4" />
                <span>{depute.profession}</span>
              </div>
            )}
            {depute.dateNaissance && (
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>
                  {new Date(depute.dateNaissance).toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Liens */}
          <div className="mt-4 flex items-center justify-center gap-4 md:justify-start">
            {depute.twitter && (
              <a
                href={`https://twitter.com/${depute.twitter}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border p-2 hover:bg-accent"
                title="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
            )}
            {depute.email && (
              <a
                href={`mailto:${depute.email}`}
                className="rounded-lg border p-2 hover:bg-accent"
                title="Email"
              >
                <Mail className="h-5 w-5" />
              </a>
            )}
            {depute.siteWeb && (
              <a
                href={depute.siteWeb}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border p-2 hover:bg-accent"
                title="Site web"
              >
                <Globe className="h-5 w-5" />
              </a>
            )}
          </div>

          {/* Source */}
          <p className="mt-4 text-xs text-muted-foreground">
            Source : <a href="https://data.assemblee-nationale.fr" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">data.assemblee-nationale.fr</a>
          </p>
        </div>
      </div>

      {/* Statistiques */}
      {depute.stats && (
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">Statistiques</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Présence solennelle"
              value={depute.stats.presenceSolennel ?? depute.stats.presence}
              suffix="%"
              subtitle={`${depute.stats.presence}% tous scrutins`}
              icon={TrendingUp}
            />
            <StatCard
              label="Loyauté au groupe"
              value={depute.stats.loyaute}
              suffix="%"
              icon={Users}
            />
            <StatCard
              label="Votes"
              value={depute.stats.participation}
              icon={Vote}
            />
            <StatCard
              label="Interventions"
              value={depute.stats.interventions}
              icon={MessageSquare}
            />
          </div>
        </div>
      )}

      {/* Onglets */}
      <div className="border-b">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('votes')}
            className={`pb-4 ${activeTab === 'votes' ? 'border-b-2 border-primary font-medium text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Votes récents
          </button>
          <button
            onClick={() => setActiveTab('interventions')}
            className={`pb-4 ${activeTab === 'interventions' ? 'border-b-2 border-primary font-medium text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Interventions
          </button>
          <button
            onClick={() => setActiveTab('amendements')}
            className={`pb-4 ${activeTab === 'amendements' ? 'border-b-2 border-primary font-medium text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Amendements
          </button>
        </nav>
      </div>

      {/* Contenu */}
      <div className="mt-8">
        {activeTab === 'votes' && <VotesList slug={depute.slug} />}
        {activeTab === 'interventions' && <InterventionsList slug={depute.slug} />}
        {activeTab === 'amendements' && <AmendementsList slug={depute.slug} />}
      </div>
    </div>
  );
}
