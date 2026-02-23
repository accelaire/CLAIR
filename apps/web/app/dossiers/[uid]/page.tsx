'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  FileText, Calendar, Vote, CheckCircle, XCircle, ExternalLink,
  ArrowLeft, Loader2, Scale, ChevronDown, ChevronUp,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

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

interface DossierDetail {
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
  scrutins: DossierScrutin[];
  amendements: DossierAmendement[];
  scrutinsCount: number;
  amendementsCount: number;
  votedAmendementsCount: number;
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

const etatLabels: Record<string, { label: string; color: string }> = {
  en_cours: { label: 'En cours', color: 'bg-amber-100 text-amber-700' },
  adopte: { label: 'Adopté', color: 'bg-blue-100 text-blue-700' },
  rejete: { label: 'Rejeté', color: 'bg-red-100 text-red-700' },
  promulgue: { label: 'Promulgué', color: 'bg-green-100 text-green-700' },
};

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

          {/* Lien vers le scrutin si l'amendement a ete vote */}
          {amendement.scrutins && amendement.scrutins.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              {amendement.scrutins.map((s) => (
                <Link
                  key={s.id}
                  href={`/scrutins/${s.numero}?chambre=${s.chambre || 'assemblee'}${s.chambre === 'senat' && s.session ? `&session=${s.session}` : ''}`}
                  className="inline-flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-800 hover:underline bg-indigo-50 px-3 py-1.5 rounded-md transition-colors mr-2 mb-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Vote className="h-3.5 w-3.5" />
                  <span>Voir le vote n&deg;{s.numero}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    s.sort === 'adopte' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {s.sort === 'adopte' ? 'Adopté' : 'Rejeté'}
                  </span>
                </Link>
              ))}
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DossierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const uid = params.uid as string;
  const [showVotedOnly, setShowVotedOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<'amendements' | 'scrutins'>('amendements');

  const { data: dossier, isLoading, error } = useQuery<DossierDetail>({
    queryKey: ['dossier', uid],
    queryFn: () => api.get(`/dossiers/${uid}`).then((res) => res.data),
  });

  // Infinite query for more scrutins (after the first 20)
  const {
    data: moreScrutins,
    fetchNextPage: fetchNextScrutins,
    hasNextPage: hasNextScrutins,
    isFetchingNextPage: isFetchingNextScrutins,
  } = useInfiniteQuery<PaginatedResponse<DossierScrutin>>({
    queryKey: ['dossier-scrutins', uid],
    queryFn: ({ pageParam = 2 }) =>
      api.get(`/dossiers/${uid}/scrutins`, {
        params: { page: pageParam, limit: 20 },
      }).then((res) => res.data),
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 2,
    enabled: !!dossier && dossier.scrutinsCount > 20,
  });

  const { loadMoreRef: loadMoreScrutinsRef } = useInfiniteScroll({
    hasNextPage: hasNextScrutins,
    isFetchingNextPage: isFetchingNextScrutins,
    fetchNextPage: fetchNextScrutins,
  });

  // Infinite query for all amendements (page 2+, detail endpoint gives first 20)
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
    enabled: !!dossier && !showVotedOnly && dossier.amendementsCount > 20,
  });

  const { loadMoreRef: loadMoreAmendementsRef } = useInfiniteScroll({
    hasNextPage: hasNextAmendements,
    isFetchingNextPage: isFetchingNextAmendements,
    fetchNextPage: fetchNextAmendements,
  });

  // Infinite query for voted-only amendements (fully server-side, page 1+)
  const {
    data: votedAmendementsData,
    fetchNextPage: fetchNextVoted,
    hasNextPage: hasNextVoted,
    isFetchingNextPage: isFetchingNextVoted,
    isLoading: isLoadingVoted,
  } = useInfiniteQuery<PaginatedResponse<DossierAmendement>>({
    queryKey: ['dossier-amendements-voted', uid],
    queryFn: ({ pageParam = 1 }) =>
      api.get(`/dossiers/${uid}/amendements`, {
        params: { page: pageParam, limit: 20, voted: true },
      }).then((res) => res.data),
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
    enabled: !!dossier && showVotedOnly && dossier.votedAmendementsCount > 0,
  });

  const { loadMoreRef: loadMoreVotedRef } = useInfiniteScroll({
    hasNextPage: hasNextVoted,
    isFetchingNextPage: isFetchingNextVoted,
    fetchNextPage: fetchNextVoted,
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
  const totalVotes = dossier.stats.totalAdopte + dossier.stats.totalRejete;

  // Amendements: merge initial batch + paginated extras
  const allAmendements = [
    ...(dossier.amendements || []),
    ...(moreAmendements?.pages.flatMap((p) => p.data) ?? []),
  ];
  const votedAmendements = votedAmendementsData?.pages.flatMap((p) => p.data) ?? [];
  const displayedAmendements = showVotedOnly ? votedAmendements : allAmendements;

  // Auto-switch to scrutins tab if no amendements
  const hasAmendements = dossier.amendementsCount > 0;
  const effectiveTab = hasAmendements ? activeTab : 'scrutins';

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
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${dossier.chambre === 'senat' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
            {dossier.chambre === 'senat' ? 'Sénat' : 'Assemblée nationale'}
          </span>
          {dossier.etat && (
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${etatLabels[dossier.etat]?.color || 'bg-muted text-muted-foreground'}`}>
              {etatLabels[dossier.etat]?.label || dossier.etat}
            </span>
          )}
          {dossier.procedureLibelle && (
            <span className="px-3 py-1 text-sm font-medium bg-slate-100 text-slate-600 rounded-full">
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
        </div>
      </div>

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
            <span className="text-green-600 font-medium">{dossier.stats.totalAdopte} adopté{dossier.stats.totalAdopte > 1 ? 's' : ''}</span>
            <span className="text-red-600 font-medium">{dossier.stats.totalRejete} rejeté{dossier.stats.totalRejete > 1 ? 's' : ''}</span>
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
              <p className="font-semibold text-gray-900">Loi n&deg;{dossier.loiNumero}</p>
              {dossier.loiTitre && <p className="text-sm text-gray-600">{dossier.loiTitre}</p>}
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
          {dossier.votedAmendementsCount > 0 && (
            <div className="flex items-center">
              <button
                onClick={() => setShowVotedOnly(!showVotedOnly)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  showVotedOnly
                    ? 'bg-indigo-100 border-indigo-300 text-indigo-700 hover:bg-indigo-200'
                    : 'bg-background border-input hover:bg-accent'
                }`}
              >
                <Vote className={`h-4 w-4 ${showVotedOnly ? 'text-indigo-600' : 'text-muted-foreground'}`} />
                Votés individuellement
                <span className={`px-1.5 py-0.5 rounded text-xs ${
                  showVotedOnly ? 'bg-indigo-200 text-indigo-800' : 'bg-muted text-muted-foreground'
                }`}>
                  {dossier.votedAmendementsCount}
                </span>
              </button>
            </div>
          )}

          {/* Loading state for voted filter */}
          {showVotedOnly && isLoadingVoted && (
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

              {/* Infinite scroll sentinel: all amendements */}
              {!showVotedOnly && dossier.amendementsCount > 20 && (
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

              {/* Infinite scroll sentinel: voted only */}
              {showVotedOnly && dossier.votedAmendementsCount > 20 && (
                <div ref={loadMoreVotedRef} className="mt-8 flex justify-center py-4">
                  {isFetchingNextVoted && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" /> <span>Chargement...</span>
                    </div>
                  )}
                  {!hasNextVoted && !isFetchingNextVoted && (
                    <p className="text-sm text-muted-foreground">Tous les amendements votés ont été chargés</p>
                  )}
                </div>
              )}
            </>
          ) : (
            !isLoadingVoted && (
              <p className="text-center text-muted-foreground py-8">
                {showVotedOnly
                  ? 'Aucun amendement ayant fait l\'objet d\'un vote.'
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
          {allScrutins.length > 0 ? (
            <>
              <div className="space-y-3">
                {allScrutins.map((scrutin) => {
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
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${scrutin.chambre === 'senat' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                              {scrutin.chambre === 'senat' ? 'Sénat' : 'AN'}
                            </span>
                            {/* Amendements linked to this scrutin */}
                            {scrutin.amendements && scrutin.amendements.length > 0 && (
                              <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
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
                            scrutin.sort === 'adopte' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
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
