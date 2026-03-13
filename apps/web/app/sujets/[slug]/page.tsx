'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, Calendar, Vote, FileText, Loader2, CheckCircle, XCircle,
  ExternalLink, Layers,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { DOSSIER_ETAT_CONFIG } from '@/lib/dossiers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SujetDetail {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  category: string | null;
  dossierCount: number;
  scrutinCount: number;
  matchMethod: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  featured: boolean;
}

interface SujetDossier {
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
  loiNumero: string | null;
  scrutinCount: number;
}

interface SujetScrutin {
  id: string;
  numero: number;
  chambre: string;
  session: string;
  date: string;
  titre: string;
  typeVote: string;
  sort: string;
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
  tags: string[];
  importance: number;
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

interface GroupeVoteStats {
  nom: string;
  slug: string;
  couleur: string;
  chambre: string;
  votes: { pour: number; contre: number; abstention: number; absent: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const etatLabels = DOSSIER_ETAT_CONFIG;

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const formatDateShort = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

const MATCH_METHOD_LABELS: Record<string, { label: string; color: string }> = {
  cross_ref: { label: 'Cross-chambre', color: 'bg-indigo-100 text-indigo-700' },
  loi_numero: { label: 'Loi commune', color: 'bg-emerald-100 text-emerald-700' },
  solo: { label: 'Mono-chambre', color: 'bg-slate-100 text-slate-600' },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SujetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [activeTab, setActiveTab] = useState<'dossiers' | 'scrutins' | 'stats'>('dossiers');

  // Fetch sujet detail
  const { data: sujetData, isLoading, error } = useQuery<{ data: SujetDetail }>({
    queryKey: ['sujet', slug],
    queryFn: () => api.get(`/sujets/${slug}`).then((res) => res.data),
  });
  const sujet = sujetData?.data;

  // Fetch dossiers
  const { data: dossiersData } = useQuery<PaginatedResponse<SujetDossier>>({
    queryKey: ['sujet-dossiers', slug],
    queryFn: () => api.get(`/sujets/${slug}/dossiers`, { params: { limit: 50 } }).then((res) => res.data),
    enabled: !!sujet,
  });

  // Fetch scrutins (infinite)
  const {
    data: scrutinsPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<PaginatedResponse<SujetScrutin>>({
    queryKey: ['sujet-scrutins', slug],
    queryFn: ({ pageParam = 1 }) =>
      api.get(`/sujets/${slug}/scrutins`, {
        params: { page: pageParam, limit: 20 },
      }).then((res) => res.data),
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
    enabled: !!sujet && activeTab === 'scrutins',
  });

  const { loadMoreRef } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  // Fetch vote stats
  const { data: statsData } = useQuery<{ data: GroupeVoteStats[] }>({
    queryKey: ['sujet-stats', slug],
    queryFn: () => api.get(`/sujets/${slug}/stats`).then((res) => res.data),
    enabled: !!sujet && activeTab === 'stats',
  });

  const dossiers = dossiersData?.data ?? [];
  const scrutins = scrutinsPages?.pages.flatMap((p) => p.data) ?? [];
  const groupeStats = statsData?.data ?? [];

  // Loading
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-1/2 rounded bg-muted" />
          <div className="h-6 w-3/4 rounded bg-muted" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg bg-muted" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error || !sujet) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Sujet non trouv&eacute;.
        </div>
      </div>
    );
  }

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
        <Link href="/sujets" className="hover:text-foreground transition-colors flex-shrink-0">Sujets</Link>
        <span className="flex-shrink-0">/</span>
        <span className="text-foreground font-medium truncate">{sujet.label}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {sujet.matchMethod && MATCH_METHOD_LABELS[sujet.matchMethod] && (
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${MATCH_METHOD_LABELS[sujet.matchMethod].color}`}>
              {MATCH_METHOD_LABELS[sujet.matchMethod].label}
            </span>
          )}
          {sujet.category && (
            <span className="px-3 py-1 text-sm font-medium bg-amber-100 text-amber-700 rounded-full">
              {sujet.category}
            </span>
          )}
        </div>

        <h1 className="text-2xl md:text-3xl font-bold mb-3">{sujet.label}</h1>

        {sujet.description && (
          <p className="text-muted-foreground mb-3">{sujet.description}</p>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="rounded-lg border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-primary">{sujet.dossierCount}</div>
          <div className="text-sm text-muted-foreground">Dossier{sujet.dossierCount > 1 ? 's' : ''}</div>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-primary">{sujet.scrutinCount}</div>
          <div className="text-sm text-muted-foreground">Scrutin{sujet.scrutinCount > 1 ? 's' : ''}</div>
        </div>
        {sujet.matchMethod === 'cross_ref' && (
          <div className="rounded-lg border bg-card p-4 text-center col-span-2 md:col-span-1">
            <div className="flex items-center justify-center gap-2 text-2xl font-bold text-indigo-600">
              <Layers className="h-6 w-6" />
              AN + S&eacute;nat
            </div>
            <div className="text-sm text-muted-foreground">Navette parlementaire</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b mb-6">
        <button
          onClick={() => setActiveTab('dossiers')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'dossiers'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="h-4 w-4 inline mr-1.5 -mt-0.5" />
          Dossiers ({sujet.dossierCount})
        </button>
        <button
          onClick={() => setActiveTab('scrutins')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'scrutins'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Vote className="h-4 w-4 inline mr-1.5 -mt-0.5" />
          Scrutins ({sujet.scrutinCount})
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'stats'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Stats par groupe
        </button>
      </div>

      {/* ================================================================= */}
      {/* TAB: Dossiers                                                     */}
      {/* ================================================================= */}
      {activeTab === 'dossiers' && (
        <div className="space-y-4">
          {dossiers.map((dossier) => (
            <Link
              key={dossier.id}
              href={`/dossiers/${dossier.uid}`}
              className="block rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${dossier.chambre === 'senat' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {dossier.chambre === 'senat' ? 'S\u00e9nat' : 'AN'}
                    </span>
                    {dossier.etat && etatLabels[dossier.etat] && (
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${etatLabels[dossier.etat].color}`}>
                        {etatLabels[dossier.etat].label}
                      </span>
                    )}
                    {dossier.procedureLibelle && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                        {dossier.procedureLibelle}
                      </span>
                    )}
                  </div>

                  <h3 className="font-semibold text-lg leading-tight mb-2 line-clamp-2">
                    {dossier.titreCourt || dossier.titre}
                  </h3>

                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Vote className="h-4 w-4" />
                      {dossier.scrutinCount} scrutin{dossier.scrutinCount > 1 ? 's' : ''}
                    </span>
                    {dossier.loiNumero && (
                      <span className="text-green-700 font-medium">
                        Loi n&deg;{dossier.loiNumero}
                      </span>
                    )}
                    {dossier.urlAN && (
                      <span className="text-purple-600 text-xs">AN</span>
                    )}
                    {dossier.urlSenat && (
                      <span className="text-blue-600 text-xs">S&eacute;nat</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center">
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </Link>
          ))}

          {dossiers.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Aucun dossier associ&eacute; &agrave; ce sujet.
            </p>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB: Scrutins                                                     */}
      {/* ================================================================= */}
      {activeTab === 'scrutins' && (
        <>
          {scrutins.length > 0 ? (
            <>
              <div className="space-y-3">
                {scrutins.map((scrutin) => {
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
                              {scrutin.chambre === 'senat' ? 'S\u00e9nat' : 'AN'}
                            </span>
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
                            {scrutin.sort === 'adopte' ? 'Adopt\u00e9' : 'Rejet\u00e9'}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <div ref={loadMoreRef} className="mt-8 flex justify-center py-4">
                {isFetchingNextPage && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Chargement...</span>
                  </div>
                )}
                {!hasNextPage && scrutins.length > 0 && (
                  <p className="text-sm text-muted-foreground">Tous les scrutins ont &eacute;t&eacute; charg&eacute;s</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">Aucun scrutin.</p>
          )}
        </>
      )}

      {/* ================================================================= */}
      {/* TAB: Stats par groupe                                             */}
      {/* ================================================================= */}
      {activeTab === 'stats' && (
        <div>
          {groupeStats.length > 0 ? (
            <div className="space-y-3">
              {groupeStats
                .sort((a, b) => {
                  const totalA = a.votes.pour + a.votes.contre + a.votes.abstention + a.votes.absent;
                  const totalB = b.votes.pour + b.votes.contre + b.votes.abstention + b.votes.absent;
                  return totalB - totalA;
                })
                .map((groupe) => {
                  const totalVotes = groupe.votes.pour + groupe.votes.contre + groupe.votes.abstention;
                  const pourPct = totalVotes > 0 ? (groupe.votes.pour / totalVotes) * 100 : 0;
                  const contrePct = totalVotes > 0 ? (groupe.votes.contre / totalVotes) * 100 : 0;
                  const abstPct = totalVotes > 0 ? (groupe.votes.abstention / totalVotes) * 100 : 0;

                  return (
                    <div key={`${groupe.slug}-${groupe.chambre}`} className="rounded-lg border bg-card p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="h-4 w-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: groupe.couleur }}
                        />
                        <span className="font-medium">{groupe.nom}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${groupe.chambre === 'senat' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {groupe.chambre === 'senat' ? 'S\u00e9nat' : 'AN'}
                        </span>
                      </div>

                      {/* Vote bar */}
                      <div className="h-2 rounded-full bg-muted overflow-hidden flex mb-2">
                        <div className="bg-green-500" style={{ width: `${pourPct}%` }} />
                        <div className="bg-red-500" style={{ width: `${contrePct}%` }} />
                        <div className="bg-yellow-400" style={{ width: `${abstPct}%` }} />
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="text-green-600">{groupe.votes.pour.toLocaleString('fr-FR')} pour</span>
                        <span className="text-red-600">{groupe.votes.contre.toLocaleString('fr-FR')} contre</span>
                        <span className="text-yellow-600">{groupe.votes.abstention.toLocaleString('fr-FR')} abst.</span>
                        <span>{groupe.votes.absent.toLocaleString('fr-FR')} abs.</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Chargement des statistiques...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
