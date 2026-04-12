'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  FileText, Calendar, Vote, CheckCircle, XCircle, ExternalLink,
  ArrowLeft, Loader2, Scale, ChevronDown, ChevronUp, X, Users, Layers, BookOpen, Gavel,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { AmendementSortBadge } from '@/components/AmendementSortBadge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AmendementScrutin {
  id: string;
  numero: number;
  chambre: string;
  session: string;
  sort: string;
  date: string;
}

interface DossierAmendement {
  id: string;
  uid: string;
  numero: string;
  auteurLibelle: string | null;
  articleVise: string | null;
  dispositif: string | null;
  exposeSommaire: string | null;
  sort: string | null;
  dateDepot: string | null;
  scrutins: AmendementScrutin[];
}

interface ScrutinAmendementRef {
  id: string;
  numero: string;
  auteurLibelle: string | null;
  sort: string | null;
}

interface DossierScrutin {
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
  nombreVotants: number;
  amendements?: ScrutinAmendementRef[];
}

export interface DossierDetail {
  id: string;
  uid: string;
  titre: string;
  titreCourt: string | null;
  chambre: string;
  procedureCode: string | null;
  procedureLibelle: string | null;
  urlAN: string | null;
  urlSenat: string | null;
  etat: string | null;
  dateDepot: string | null;
  dateAdoption: string | null;
  loiNumero: string | null;
  loiTitre: string | null;
  loiDateJO: string | null;
  urlLegifrance: string | null;
  resumeIA: string | null;
  sujet: {
    slug: string;
    label: string;
    status: string;
  } | null;
  scrutins: DossierScrutin[];
  amendements: DossierAmendement[];
  scrutinsCount: number;
  amendementsCount: number;
  votedAmendementsCount: number;
  amendementsGroupes: Array<{
    slug: string;
    nom: string;
    couleur: string;
    count: number;
  }>;
  stats: {
    totalAdopte: number;
    totalRejete: number;
  };
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { DOSSIER_ETAT_CONFIG, getDossierEtat } from '@/lib/dossiers';

const etatLabels = DOSSIER_ETAT_CONFIG;

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const formatDateShort = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

const formatDossierTitre = (titre: string, procedureLibelle?: string | null): string => {
  const firstChar = titre.charAt(0);
  if (firstChar !== firstChar.toUpperCase() && procedureLibelle) {
    return `${procedureLibelle} ${titre}`;
  }
  return titre;
};

/** Strip HTML tags for plain text display */
const stripHtml = (html: string): string =>
  html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\r\n/g, '\n').trim();

// ---------------------------------------------------------------------------
// Sub-components (same pattern as parlementaire page)
// ---------------------------------------------------------------------------

function ExpandableAmendementCard({ amendement }: { amendement: DossierAmendement }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const exposeText = amendement.exposeSommaire ? stripHtml(amendement.exposeSommaire) : null;
  const dispositifText = amendement.dispositif ? stripHtml(amendement.dispositif) : null;
  const hasLongContent =
    (exposeText && exposeText.length > 200) || dispositifText;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-sm font-medium">
              n&deg;{amendement.numero}
            </span>
            {amendement.articleVise && (
              <span className="text-sm text-muted-foreground">
                &bull; {amendement.articleVise}
              </span>
            )}
          </div>

          {amendement.auteurLibelle && (
            <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{amendement.auteurLibelle}</p>
          )}

          {/* Expose sommaire - visible in header, line-clamped */}
          {exposeText && (
            <div className="mb-2">
              <p className={`text-sm leading-relaxed ${!isExpanded ? 'line-clamp-3' : ''}`}>
                {exposeText}
              </p>
            </div>
          )}

          {/* Dispositif (visible uniquement si expanded) */}
          {isExpanded && dispositifText && (
            <div className="mt-3 rounded bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Dispositif :</p>
              <p className="text-sm leading-relaxed whitespace-pre-line">{dispositifText}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-2">
            {amendement.dateDepot && (
              <span>
                Déposé le {formatDateShort(amendement.dateDepot)}
              </span>
            )}
          </div>

        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <AmendementSortBadge sort={amendement.sort} />
          {/* Lien vers le scrutin si l'amendement a ete vote */}
          {amendement.scrutins && amendement.scrutins.length > 0 && (
            <div className="flex flex-col items-end gap-1">
              {amendement.scrutins.map((s) => (
                <Link
                  key={s.id}
                  href={`/scrutins/${s.numero}?chambre=${s.chambre || 'assemblee'}${s.chambre === 'senat' && s.session ? `&session=${s.session}` : ''}`}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline w-fit"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="hidden sm:inline">Voir le vote n&deg;{s.numero}</span>
                  <span className="sm:hidden">Vote n&deg;{s.numero}</span>
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </div>
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PageClient({ initialData }: { initialData?: DossierDetail }) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = params.uid as string;
  const [showVotedOnly, setShowVotedOnly] = useState(false);
  const [showSolennelOnly, setShowSolennelOnly] = useState(false);
  const [showMotionOnly, setShowMotionOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<'amendements' | 'scrutins'>(
    searchParams.get('tab') === 'scrutins' ? 'scrutins' : 'amendements',
  );

  // Groupe filter from URL (set when coming from sujet stats page)
  const groupeFilter = searchParams.get('groupe') || '';
  const hasAmendementFilter = showVotedOnly || !!groupeFilter;

  const setGroupeFilter = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) params.set('groupe', slug);
    else params.delete('groupe');
    router.replace(`/dossiers/${uid}?${params.toString()}`, { scroll: false });
  };

  const { data: dossier, isLoading, error } = useQuery<DossierDetail>({
    queryKey: ['dossier', uid],
    queryFn: () => api.get(`/dossiers/${uid}`).then((res) => res.data),
    initialData,
  });

  // Infinite query for more scrutins (after the first 20)
  const {
    data: moreScrutins,
    fetchNextPage: fetchNextScrutins,
    hasNextPage: hasNextScrutins,
    isFetchingNextPage: isFetchingNextScrutins,
  } = useInfiniteQuery<PaginatedResponse<DossierScrutin>>({
    queryKey: ['dossier-scrutins', uid, showSolennelOnly],
    queryFn: ({ pageParam = 2 }) =>
      api.get(`/dossiers/${uid}/scrutins`, {
        params: { page: pageParam, limit: 20 },
      }).then((res) => res.data),
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 2,
    enabled: !!dossier && (showSolennelOnly || dossier.scrutinsCount > 20),
  });

  const { loadMoreRef: loadMoreScrutinsRef } = useInfiniteScroll({
    hasNextPage: hasNextScrutins,
    isFetchingNextPage: isFetchingNextScrutins,
    fetchNextPage: fetchNextScrutins,
  });

  // Infinite query for unfiltered amendements (page 2+, detail gives first 20)
  const {
    data: moreAmendements,
    fetchNextPage: fetchNextAmendements,
    hasNextPage: hasNextAmendements,
    isFetchingNextPage: isFetchingNextAmendements,
  } = useInfiniteQuery<PaginatedResponse<DossierAmendement>>({
    queryKey: ['dossier-amendements', uid],
    queryFn: ({ pageParam = 2 }) =>
      api.get(`/dossiers/${uid}/amendements`, {
        params: { page: pageParam, limit: 20 },
      }).then((res) => res.data),
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 2,
    enabled: !!dossier && !hasAmendementFilter && dossier.amendementsCount > 20,
  });

  const { loadMoreRef: loadMoreAmendementsRef } = useInfiniteScroll({
    hasNextPage: hasNextAmendements,
    isFetchingNextPage: isFetchingNextAmendements,
    fetchNextPage: fetchNextAmendements,
  });

  // Infinite query for filtered amendements (voted and/or groupe, page 1+)
  const {
    data: filteredAmendementsData,
    fetchNextPage: fetchNextFiltered,
    hasNextPage: hasNextFiltered,
    isFetchingNextPage: isFetchingNextFiltered,
    isLoading: isLoadingFiltered,
  } = useInfiniteQuery<PaginatedResponse<DossierAmendement>>({
    queryKey: ['dossier-amendements-filtered', uid, showVotedOnly, groupeFilter],
    queryFn: ({ pageParam = 1 }) =>
      api.get(`/dossiers/${uid}/amendements`, {
        params: {
          page: pageParam,
          limit: 20,
          ...(showVotedOnly && { voted: true }),
          ...(groupeFilter && { groupe: groupeFilter }),
        },
      }).then((res) => res.data),
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
    enabled: !!dossier && (hasAmendementFilter || !!groupeFilter),
  });

  // Count of voted amendements for the selected group (for counter)
  const { data: groupeVotedCount } = useQuery<number>({
    queryKey: ['dossier-amendements-voted-count', uid, groupeFilter],
    queryFn: () =>
      api.get(`/dossiers/${uid}/amendements`, {
        params: { page: 1, limit: 1, voted: true, ...(groupeFilter && { groupe: groupeFilter }) },
      }).then((res) => res.data.meta.total),
    enabled: !!dossier && !!groupeFilter,
  });

  const { loadMoreRef: loadMoreFilteredRef } = useInfiniteScroll({
    hasNextPage: hasNextFiltered,
    isFetchingNextPage: isFetchingNextFiltered,
    fetchNextPage: fetchNextFiltered,
  });

  // Loading
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-1/2 rounded bg-muted" />
          <div className="h-6 w-3/4 rounded bg-muted" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-lg bg-muted" />)}
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-lg bg-muted" />)}
          </div>
        </div>
      </div>
    );
  }

  // Error
  if (error || !dossier) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Dossier législatif non trouvé.
        </div>
      </div>
    );
  }

  const allScrutins = [
    ...dossier.scrutins,
    ...(moreScrutins?.pages.flatMap((p) => p.data) ?? []),
  ];
  const filteredScrutins = showSolennelOnly
    ? allScrutins.filter((s) => s.typeVote === 'solennel' || s.titre.includes("l'ensemble") || s.titre.includes("l'ensemble de la"))
    : showMotionOnly
    ? allScrutins.filter((s) => s.typeVote === 'motion')
    : allScrutins;
  const totalVotes = dossier.stats.totalAdopte + dossier.stats.totalRejete;

  // Amendements: filtered → use filtered query; unfiltered → detail batch + extras
  const displayedAmendements = hasAmendementFilter
    ? (filteredAmendementsData?.pages.flatMap((p) => p.data) ?? [])
    : [
        ...(dossier.amendements || []),
        ...(moreAmendements?.pages.flatMap((p) => p.data) ?? []),
      ];
  const filteredTotal = filteredAmendementsData?.pages[0]?.meta.total;

  // Auto-switch to scrutins tab if no amendements
  const hasAmendements = dossier.amendementsCount > 0;
  const effectiveTab = hasAmendements ? activeTab : 'scrutins';

  // Counts for filter badges (from all loaded scrutins)
  const solennelCount = allScrutins.filter(
    (s) => s.typeVote === 'solennel' || s.titre.toLowerCase().includes("l'ensemble"),
  ).length;
  const motionCount = allScrutins.filter((s) => s.typeVote === 'motion').length;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6 min-w-0">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center justify-center rounded-lg p-1.5 hover:bg-muted transition-colors flex-shrink-0"
          aria-label="Retour"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Link href="/dossiers" className="hover:text-foreground transition-colors flex-shrink-0">Dossiers</Link>
        <span className="flex-shrink-0">/</span>
        <span className="text-foreground font-medium truncate">{dossier.uid}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${dossier.chambre === 'senat' ? 'badge-senat' : 'badge-assemblee'}`}>
            {dossier.chambre === 'senat' ? 'Sénat' : 'Assemblée nationale'}
          </span>
          {dossier.etat && (
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${etatLabels[dossier.etat]?.color || 'bg-muted text-muted-foreground'}`}>
              {etatLabels[dossier.etat]?.label || dossier.etat}
            </span>
          )}
          {dossier.procedureLibelle && (
            <span className="px-3 py-1 text-sm font-medium bg-muted text-muted-foreground rounded-full">
              {dossier.procedureLibelle}
            </span>
          )}
        </div>

        <h1 className="text-2xl md:text-3xl font-bold mb-3">
          {formatDossierTitre(dossier.titre, dossier.procedureLibelle)}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {dossier.dateDepot && (
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Déposé le {formatDate(dossier.dateDepot)}
            </span>
          )}
          {dossier.urlAN && dossier.chambre === 'assemblee' && (
            <a href={dossier.urlAN} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline">
              <ExternalLink className="h-3 w-3" /> Assemblée nationale
            </a>
          )}
          {dossier.urlSenat && dossier.chambre === 'senat' && (
            <a href={dossier.urlSenat} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline">
              <ExternalLink className="h-3 w-3" /> Sénat
            </a>
          )}
          {dossier.sujet && (
            <Link
              href={`/sujets/${dossier.sujet.slug}`}
              className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-800 hover:underline"
            >
              <Layers className="h-3.5 w-3.5" />
              Voir le sujet complet
            </Link>
          )}
        </div>
      </div>

      {/* En clair — IA summary */}
      {dossier.resumeIA && (
        <div className="rounded-lg border bg-card p-5 mb-8">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-2">
            <BookOpen className="h-4 w-4" />
            En clair
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {dossier.resumeIA}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-2">
            Résumé généré par IA
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-primary">{dossier.scrutinsCount}</div>
          <div className="text-sm text-muted-foreground">Scrutin{dossier.scrutinsCount > 1 ? 's' : ''}</div>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{dossier.stats.totalAdopte}</div>
          <div className="text-sm text-muted-foreground">Adopté{dossier.stats.totalAdopte > 1 ? 's' : ''}</div>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{dossier.stats.totalRejete}</div>
          <div className="text-sm text-muted-foreground">Rejeté{dossier.stats.totalRejete > 1 ? 's' : ''}</div>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <div className="text-2xl font-bold">{dossier.amendementsCount}</div>
          <div className="text-sm text-muted-foreground">Amendement{dossier.amendementsCount > 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Adopte/Rejete bar */}
      {totalVotes > 0 && (
        <div className="mb-8">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-adopte font-medium">{dossier.stats.totalAdopte} adopté{dossier.stats.totalAdopte > 1 ? 's' : ''}</span>
            <span className="text-rejete font-medium">{dossier.stats.totalRejete} rejeté{dossier.stats.totalRejete > 1 ? 's' : ''}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden flex">
            <div className="bg-green-500 transition-all" style={{ width: `${(dossier.stats.totalAdopte / totalVotes) * 100}%` }} />
            <div className="bg-red-500 transition-all" style={{ width: `${(dossier.stats.totalRejete / totalVotes) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Loi promulguee */}
      {dossier.loiNumero && (
        <div className="p-4 rounded-lg border border-green-200 bg-green-50/50 mb-8">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <Scale className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <span className="text-xs font-medium text-green-600 uppercase tracking-wide">Loi promulguée</span>
              <p className="font-semibold text-foreground">Loi n&deg;{dossier.loiNumero}</p>
              {dossier.loiTitre && <p className="text-sm text-muted-foreground">{dossier.loiTitre}</p>}
              {dossier.loiDateJO && (
                <p className="text-xs text-muted-foreground mt-1">Publiée au JO le {formatDate(dossier.loiDateJO)}</p>
              )}
              {dossier.urlLegifrance && (
                <a
                  href={dossier.urlLegifrance}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Consulter le texte de loi sur Légifrance
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs: Amendements / Scrutins */}
      <div className="flex items-center gap-1 border-b mb-6">
        {hasAmendements && (
          <button
            onClick={() => setActiveTab('amendements')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              effectiveTab === 'amendements'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            Amendements ({dossier.amendementsCount})
          </button>
        )}
        <button
          onClick={() => setActiveTab('scrutins')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            effectiveTab === 'scrutins'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Vote className="h-4 w-4 inline mr-1.5 -mt-0.5" />
          Scrutins ({dossier.scrutinsCount})
        </button>
      </div>

      {/* ================================================================== */}
      {/* TAB: Amendements                                                   */}
      {/* ================================================================== */}
      {effectiveTab === 'amendements' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Voted toggle */}
            {dossier.votedAmendementsCount > 0 && (
              <button
                onClick={() => setShowVotedOnly(!showVotedOnly)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  showVotedOnly
                    ? 'bg-indigo-100 border-indigo-300 text-indigo-700 hover:bg-indigo-200'
                    : 'bg-background border-input hover:bg-accent'
                }`}
              >
                <Vote className={`h-4 w-4 ${showVotedOnly ? 'text-indigo-600' : 'text-muted-foreground'}`} />
                Votes publics
                <span className={`px-1.5 py-0.5 rounded text-xs ${
                  showVotedOnly ? 'bg-indigo-200 text-indigo-800' : 'bg-muted text-muted-foreground'
                }`}>
                  {showVotedOnly && filteredTotal !== undefined
                    ? filteredTotal
                    : !!groupeFilter && groupeVotedCount !== undefined
                    ? groupeVotedCount
                    : dossier.votedAmendementsCount}
                </span>
              </button>
            )}

            {/* Groupe filter */}
            {dossier.amendementsGroupes && dossier.amendementsGroupes.length > 0 && (
              <div className="relative">
                <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <select
                  value={groupeFilter}
                  onChange={(e) => setGroupeFilter(e.target.value)}
                  className={`appearance-none rounded-lg border pl-9 pr-8 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                    groupeFilter
                      ? 'bg-purple-100 border-purple-300 text-purple-700'
                      : 'bg-background border-input hover:bg-accent'
                  }`}
                >
                  <option value="">Tous les groupes</option>
                  {dossier.amendementsGroupes.map((g) => (
                    <option key={g.slug} value={g.slug}>
                      {g.nom} ({g.count})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            )}

            </div>

          {/* Loading state for filtered query */}
          {hasAmendementFilter && isLoadingFiltered && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {displayedAmendements.length > 0 ? (
            <>
              <div className="space-y-4">
                {displayedAmendements.map((a) => (
                  <ExpandableAmendementCard key={a.id} amendement={a} />
                ))}
              </div>

              {/* Infinite scroll sentinel: filtered */}
              {hasAmendementFilter && (
                <div ref={loadMoreFilteredRef} className="mt-8 flex justify-center py-4">
                  {isFetchingNextFiltered && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" /> <span>Chargement...</span>
                    </div>
                  )}
                  {!hasNextFiltered && !isFetchingNextFiltered && displayedAmendements.length > 0 && (
                    <p className="text-sm text-muted-foreground">Tous les amendements ont été chargés</p>
                  )}
                </div>
              )}

              {/* Infinite scroll sentinel: unfiltered */}
              {!hasAmendementFilter && dossier.amendementsCount > 20 && (
                <div ref={loadMoreAmendementsRef} className="mt-8 flex justify-center py-4">
                  {isFetchingNextAmendements && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" /> <span>Chargement...</span>
                    </div>
                  )}
                  {!hasNextAmendements && (
                    <p className="text-sm text-muted-foreground">Tous les amendements ont été chargés</p>
                  )}
                </div>
              )}
            </>
          ) : (
            !isLoadingFiltered && (
              <p className="text-center text-muted-foreground py-8">
                {hasAmendementFilter
                  ? 'Aucun amendement correspondant aux filtres.'
                  : 'Aucun amendement associé à ce dossier.'}
              </p>
            )
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB: Scrutins                                                      */}
      {/* ================================================================== */}
      {effectiveTab === 'scrutins' && (
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <button
              onClick={() => { setShowSolennelOnly(!showSolennelOnly); setShowMotionOnly(false); }}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                showSolennelOnly
                  ? 'bg-indigo-100 border-indigo-300 text-indigo-700 hover:bg-indigo-200'
                  : 'bg-background border-input hover:bg-accent'
              }`}
            >
              <Scale className={`h-4 w-4 ${showSolennelOnly ? 'text-indigo-600' : 'text-muted-foreground'}`} />
              Votes solennels
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                showSolennelOnly ? 'bg-indigo-200 text-indigo-800' : 'bg-muted text-muted-foreground'
              }`}>
                {solennelCount}
              </span>
            </button>

            {motionCount > 0 && (
              <button
                onClick={() => { setShowMotionOnly(!showMotionOnly); setShowSolennelOnly(false); }}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  showMotionOnly
                    ? 'bg-indigo-100 border-indigo-300 text-indigo-700 hover:bg-indigo-200'
                    : 'bg-background border-input hover:bg-accent'
                }`}
              >
                <Gavel className={`h-4 w-4 ${showMotionOnly ? 'text-indigo-600' : 'text-muted-foreground'}`} />
                Motions
                <span className={`px-1.5 py-0.5 rounded text-xs ${
                  showMotionOnly ? 'bg-indigo-200 text-indigo-800' : 'bg-muted text-muted-foreground'
                }`}>
                  {motionCount}
                </span>
              </button>
            )}
          </div>

          {filteredScrutins.length > 0 ? (
            <>
              <div className="space-y-3">
                {filteredScrutins.map((scrutin) => {
                  const total = scrutin.nombrePour + scrutin.nombreContre + scrutin.nombreAbstention;
                  const pourPct = total > 0 ? (scrutin.nombrePour / total) * 100 : 0;
                  const contrePct = total > 0 ? (scrutin.nombreContre / total) * 100 : 0;

                  return (
                    <Link
                      key={scrutin.id}
                      href={`/scrutins/${scrutin.numero}?chambre=${scrutin.chambre || 'assemblee'}${scrutin.chambre === 'senat' && scrutin.session ? `&session=${scrutin.session}` : ''}`}
                      className="block rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm text-muted-foreground">{formatDateShort(scrutin.date)}</span>
                            <span className="text-sm font-medium text-muted-foreground">n&deg;{scrutin.numero}</span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${scrutin.chambre === 'senat' ? 'badge-senat' : 'badge-assemblee'}`}>
                              {scrutin.chambre === 'senat' ? 'Sénat' : 'AN'}
                            </span>
                            {/* Amendements linked to this scrutin */}
                            {scrutin.amendements && scrutin.amendements.length > 0 && (
                              <span className="px-2 py-0.5 text-xs badge-important rounded">
                                {scrutin.amendements.length} amdt{scrutin.amendements.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <h3 className="font-medium leading-tight line-clamp-2 mb-2">{scrutin.titre}</h3>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden flex max-w-md">
                            <div className="bg-green-500" style={{ width: `${pourPct}%` }} />
                            <div className="bg-red-500" style={{ width: `${contrePct}%` }} />
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" /> {scrutin.nombrePour}
                            </span>
                            <span className="flex items-center gap-1 text-red-600">
                              <XCircle className="h-4 w-4" /> {scrutin.nombreContre}
                            </span>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            scrutin.sort === 'adopte' ? 'badge-adopte' : 'badge-rejete'
                          }`}>
                            {scrutin.sort === 'adopte' ? 'Adopté' : 'Rejeté'}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {dossier.scrutinsCount > 20 && (
                <div ref={loadMoreScrutinsRef} className="mt-8 flex justify-center py-4">
                  {isFetchingNextScrutins && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" /> <span>Chargement...</span>
                    </div>
                  )}
                  {!hasNextScrutins && (
                    <p className="text-sm text-muted-foreground">Tous les scrutins ont été chargés</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Aucun scrutin associé à ce dossier.</p>
          )}
        </>
      )}
    </div>
  );
}
