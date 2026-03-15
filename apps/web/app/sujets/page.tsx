'use client';

import { Suspense, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Search, Vote, Loader2, Layers, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { useUrlFilters } from '@/hooks/useUrlFilters';

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
  caduc:     { label: 'Caduc',      color: 'text-gray-500',   dot: 'bg-gray-400' },
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

  const sujets = data ?? [];

  // Split into sections
  const { featured, enCours, promulgues } = useMemo(() => {
    const enCoursAll = sujets
      .filter(s => s.status === 'en_cours')
      .sort((a, b) => {
        const da = a.dateDernierVote ? new Date(a.dateDernierVote).getTime() : 0;
        const db = b.dateDernierVote ? new Date(b.dateDernierVote).getTime() : 0;
        return db - da;
      });

    const promulguesAll = sujets
      .filter(s => s.status === 'promulgue')
      .sort((a, b) => {
        const da = a.dateFin ? new Date(a.dateFin).getTime() : 0;
        const db = b.dateFin ? new Date(b.dateFin).getTime() : 0;
        return db - da;
      });

    // Pick a random en_cours sujet for "À la une"
    // Criteria: min 5 scrutins + dernier vote < 30 jours
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    const featuredCandidates = enCoursAll.filter(s =>
      s.scrutinCount >= 5 &&
      s.dateDernierVote &&
      new Date(s.dateDernierVote).getTime() > thirtyDaysAgo
    );
    let featured: Sujet | null = null;
    if (featuredCandidates.length > 0 && !filters.search) {
      const dayIndex = Math.floor(Date.now() / 86400000) % featuredCandidates.length;
      featured = featuredCandidates[dayIndex];
    }

    return {
      featured,
      enCours: enCoursAll.filter(s => s.id !== featured?.id),
      promulgues: promulguesAll,
    };
  }, [sujets, filters.search]);

  const total = sujets.length;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Sujets parlementaires</h1>
        <p className="mt-2 text-muted-foreground">
          {total > 0 ? total.toLocaleString('fr-FR') : '\u2014'} sujets regroupant les dossiers AN et Sénat
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

          {/* 2. En cours */}
          {enCours.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-4">
                En cours
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {enCours.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {enCours.map((sujet) => (
                  <SujetCard key={sujet.id} sujet={sujet} />
                ))}
              </div>
            </section>
          )}

          {/* 3. Promulgués */}
          {promulgues.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-4">
                Promulgués
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {promulgues.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {promulgues.map((sujet) => (
                  <SujetCard key={sujet.id} sujet={sujet} />
                ))}
              </div>
            </section>
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

export default function SujetsPage() {
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
