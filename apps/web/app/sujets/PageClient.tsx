'use client';

import { Suspense, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Search, Vote, Loader2, Layers, Sparkles, ChevronDown, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useUrlFilters } from '@/hooks/useUrlFilters';

const INITIAL_VISIBLE = 12;
const LOAD_MORE_STEP = 12;

interface Sujet {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  category: string | null;
  dossierCount: number;
  scrutinCount: number;
  matchMethod: string | null;
  status: string;
  dateDebut: string | null;
  dateFin: string | null;
  dateDernierVote: string | null;
  featured: boolean;
  featuredOrder: number;
  createdAt: string;
}

interface SujetsResponse {
  data: Sujet[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  en_cours:  { label: 'En cours',   color: 'text-amber-700',  dot: 'bg-amber-500' },
  adopte:    { label: 'Adopté',     color: 'text-blue-700',   dot: 'bg-blue-500' },
  rejete:    { label: 'Rejeté',     color: 'text-red-700',    dot: 'bg-red-500' },
  promulgue: { label: 'Promulgué',  color: 'text-green-700',  dot: 'bg-green-500' },
  caduc:     { label: 'Caduc',      color: 'text-muted-foreground',   dot: 'bg-muted-foreground' },
  retire:    { label: 'Retiré',     color: 'text-orange-700', dot: 'bg-orange-500' },
};

const formatDateShort = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });

// ── Sujet Card ──

function SujetCard({ sujet }: { sujet: Sujet }) {
  const statusCfg = STATUS_CONFIG[sujet.status] ?? STATUS_CONFIG.en_cours;

  return (
    <Link
      href={`/sujets/${sujet.slug}`}
      className="group rounded-lg border bg-card p-5 transition-all hover:border-primary hover:shadow-md flex flex-col"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusCfg.color}`}>
          <span className={`h-2 w-2 rounded-full ${statusCfg.dot}`} />
          {statusCfg.label}
        </span>
      </div>
      <h3 className="font-semibold leading-tight mb-auto line-clamp-3 group-hover:text-primary transition-colors">
        {sujet.label}
      </h3>
      <div className="flex flex-col gap-1.5 mt-4 pt-3 border-t text-[11px] text-muted-foreground">
        <div className="flex items-center justify-between">
          {sujet.dateDebut ? (
            <span>Dépôt : {formatDateShort(sujet.dateDebut)}</span>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-1">
            <Vote className="h-3 w-3" />
            {sujet.scrutinCount} scrutin{sujet.scrutinCount > 1 ? 's' : ''}
          </span>
        </div>
        {(sujet.dateDernierVote || sujet.dateFin) && (
          <div className="flex items-center justify-between">
            {sujet.dateDernierVote && (
              <span>Dernier vote : {formatDateShort(sujet.dateDernierVote)}</span>
            )}
            {sujet.status === 'promulgue' && sujet.dateFin && (
              <span className="text-green-700 font-medium">
                Promulgué {formatDateShort(sujet.dateFin)}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Featured Card (bigger) ──

function FeaturedSujetCard({ sujet }: { sujet: Sujet }) {
  const statusCfg = STATUS_CONFIG[sujet.status] ?? STATUS_CONFIG.en_cours;

  return (
    <Link
      href={`/sujets/${sujet.slug}`}
      className="group block rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 p-6 md:p-8 transition-all hover:border-primary/40 hover:shadow-lg"
    >
      <div className="flex items-center gap-3 mb-4">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-xs font-semibold text-primary">
          <Sparkles className="h-3 w-3" />
          À la une
        </span>
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusCfg.color}`}>
          <span className={`h-2 w-2 rounded-full ${statusCfg.dot}`} />
          {statusCfg.label}
        </span>
      </div>

      <h2 className="text-2xl md:text-3xl font-bold leading-tight mb-4 group-hover:text-primary transition-colors">
        {sujet.label}
      </h2>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Vote className="h-4 w-4" />
          {sujet.scrutinCount} scrutin{sujet.scrutinCount > 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1.5">
          <Layers className="h-4 w-4" />
          {sujet.dossierCount} dossier{sujet.dossierCount > 1 ? 's' : ''}
        </span>
        {sujet.dateDernierVote && (
          <span>Dernier vote : {formatDateShort(sujet.dateDernierVote)}</span>
        )}
      </div>
    </Link>
  );
}

// ── Collapsible Section ──

function CollapsibleSection({
  title,
  count,
  sujets,
  defaultOpen = true,
}: {
  title: string;
  count: number;
  sujets: Sujet[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  const visibleSujets = sujets.slice(0, visibleCount);
  const hasMore = visibleCount < sujets.length;
  const remaining = sujets.length - visibleCount;

  return (
    <section>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex w-full items-center gap-2 text-left group mb-4"
      >
        <ChevronDown
          className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        />
        <h2 className="text-lg font-semibold group-hover:text-primary transition-colors">
          {title}
        </h2>
        <span className="text-sm font-normal text-muted-foreground">
          {count}
        </span>
      </button>

      {open && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleSujets.map((sujet) => (
              <SujetCard key={sujet.id} sujet={sujet} />
            ))}
          </div>

          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setVisibleCount(prev => prev + LOAD_MORE_STEP)}
                className="rounded-lg border bg-card px-6 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
              >
                Voir plus ({remaining > LOAD_MORE_STEP ? LOAD_MORE_STEP : remaining} sur {remaining} restants)
              </button>
            </div>
          )}

          {!hasMore && sujets.length > INITIAL_VISIBLE && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setVisibleCount(INITIAL_VISIBLE)}
                className="rounded-lg border bg-card px-6 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
              >
                Réduire
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ── Main Page ──

function SujetsPageContent() {
  const [filters, setFilter] = useUrlFilters<{ search: string }>(['search']);

  // Load all sujets by fetching all pages (API max 100/page)
  const { data, isLoading, error } = useQuery<Sujet[]>({
    queryKey: ['sujets-all', filters.search],
    queryFn: async () => {
      const all: Sujet[] = [];
      let page = 1;
      while (true) {
        const res = await api.get('/sujets', {
          params: { search: filters.search || undefined, page, limit: 100 },
        });
        const body: SujetsResponse = res.data;
        all.push(...body.data);
        if (!body.meta.hasNext) break;
        page++;
      }
      return all;
    },
  });

  const sujets = useMemo(() => data ?? [], [data]);

  // Helper: tri par dateDernierVote desc (plus récent en premier)
  const sortByLastVote = (a: Sujet, b: Sujet) => {
    const da = a.dateDernierVote ? new Date(a.dateDernierVote).getTime() : 0;
    const db = b.dateDernierVote ? new Date(b.dateDernierVote).getTime() : 0;
    return db - da;
  };

  // Split into sections
  // "en_cours" + "adopte" = encore dans le parcours législatif (pas encore promulgué)
  // "promulgue" = signé en loi, terminé
  const { featured, recentlyPromulgated, enDiscussion, promulgues, rejetes, autres } = useMemo(() => {
    // En cours + Adopté = "En discussion" (parcours législatif non terminé)
    const enDiscussionAll = sujets
      .filter(s => s.status === 'en_cours' || s.status === 'adopte')
      .sort(sortByLastVote);

    const promulguesAll = sujets
      .filter(s => s.status === 'promulgue')
      .sort((a, b) => {
        const da = a.dateFin ? new Date(a.dateFin).getTime() : 0;
        const db = b.dateFin ? new Date(b.dateFin).getTime() : 0;
        return db - da;
      });

    const rejetesAll = sujets
      .filter(s => s.status === 'rejete')
      .sort(sortByLastVote);

    const autresAll = sujets
      .filter(s => s.status === 'caduc' || s.status === 'retire')
      .sort(sortByLastVote);

    // "À la une" : sujets actifs (en_cours/adopté) avec activité récente
    // Criteria: min 5 scrutins + dernier vote < 90 jours
    const ninetyDaysAgo = Date.now() - 90 * 86400000;
    const featuredCandidates = enDiscussionAll
      .filter(s =>
        s.scrutinCount >= 5 &&
        s.dateDernierVote &&
        new Date(s.dateDernierVote).getTime() > ninetyDaysAgo
      );

    let featured: Sujet | null = null;
    if (featuredCandidates.length > 0 && !filters.search) {
      const dayIndex = Math.floor(Date.now() / 86400000) % featuredCandidates.length;
      featured = featuredCandidates[dayIndex];
    }

    // Sujets promulgués récemment (< 6 mois) pour la section focus
    const sixMonthsAgo = Date.now() - 180 * 86400000;
    const recentlyPromulgated = promulguesAll.filter(s =>
      s.dateFin && new Date(s.dateFin).getTime() > sixMonthsAgo
    ).slice(0, 6);

    return {
      featured,
      recentlyPromulgated,
      enDiscussion: enDiscussionAll.filter(s => s.id !== featured?.id),
      promulgues: promulguesAll,
      rejetes: rejetesAll,
      autres: autresAll,
    };
  }, [sujets, filters.search]);

  const total = sujets.length;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Sujets parlementaires</h1>
        <p className="mt-2 text-muted-foreground">
          {total > 0 ? total.toLocaleString('fr-FR') : '\u2014'} grands textes de loi suivis de bout en bout, du dépôt au vote final — côté Assemblée comme côté Sénat
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-8 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Rechercher un sujet..."
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
          className="w-full rounded-lg border bg-background px-10 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Une erreur est survenue lors du chargement des sujets.
        </div>
      )}

      {!isLoading && !error && total > 0 && (
        <div className="space-y-12">
          {/* 1. À la une */}
          {featured && (
            <section>
              <FeaturedSujetCard sujet={featured} />
            </section>
          )}

          {/* 2. Récemment promulgués — focus horizontal */}
          {recentlyPromulgated.length > 0 && !filters.search && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h2 className="text-lg font-semibold">Récemment promulgués</h2>
                  <span className="text-sm text-muted-foreground">{recentlyPromulgated.length}</span>
                </div>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                {recentlyPromulgated.map((sujet) => (
                  <Link
                    key={sujet.id}
                    href={`/sujets/${sujet.slug}`}
                    className="min-w-[280px] max-w-[320px] flex-shrink-0 rounded-lg border border-green-200 dark:border-green-900/40 bg-green-50/50 dark:bg-green-950/20 p-4 transition-all hover:border-green-400 hover:shadow-md"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        Promulgué
                      </span>
                      {sujet.dateFin && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatDateShort(sujet.dateFin)}
                        </span>
                      )}
                    </div>
                    <h3 className="font-medium text-sm leading-tight line-clamp-2 mb-2">
                      {sujet.label}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Vote className="h-3 w-3" />
                        {sujet.scrutinCount} scrutin{sujet.scrutinCount > 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="h-3 w-3" />
                        {sujet.dossierCount} dossier{sujet.dossierCount > 1 ? 's' : ''}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* 3. En cours de discussion (en_cours + adopté) */}
          {enDiscussion.length > 0 && (
            <CollapsibleSection
              title="En cours de discussion"
              count={enDiscussion.length}
              sujets={enDiscussion}
              defaultOpen
            />
          )}

          {/* 4. Promulgués */}
          {promulgues.length > 0 && (
            <CollapsibleSection
              title="Promulgués"
              count={promulgues.length}
              sujets={promulgues}
              defaultOpen={false}
            />
          )}

          {/* 5. Rejetés */}
          {rejetes.length > 0 && (
            <CollapsibleSection
              title="Rejetés"
              count={rejetes.length}
              sujets={rejetes}
              defaultOpen={false}
            />
          )}

          {/* 6. Caducs / Retirés */}
          {autres.length > 0 && (
            <CollapsibleSection
              title="Caducs et retirés"
              count={autres.length}
              sujets={autres}
              defaultOpen={false}
            />
          )}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && total === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Aucun sujet trouvé</p>
          <p className="mt-1">Essayez de modifier votre recherche.</p>
        </div>
      )}
    </div>
  );
}

export default function PageClient() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    }>
      <SujetsPageContent />
    </Suspense>
  );
}
