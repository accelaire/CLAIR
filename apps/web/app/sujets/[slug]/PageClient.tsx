'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, Vote, Loader2,
  Layers, ExternalLink, Scale, BookOpen,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { DOSSIER_ETAT_CONFIG } from '@/lib/dossiers';
import { LegislativeStep } from '@/lib/legislative-steps';
import { LegislativeTimeline } from '@/components/LegislativeTimeline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SujetDetail {
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
  resume: string | null;
  enjeux: string | null;
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
  dateDepot: string | null;
  dateAdoption: string | null;
  loiNumero: string | null;
  loiTitre: string | null;
  loiDateJO: string | null;
  urlLegifrance: string | null;
  scrutinCount: number;
  legislativeSteps: LegislativeStep[];
}

/** Préfixe le type de procédure si le titre commence par une minuscule */
const formatDossierTitre = (titre: string, procedureLibelle?: string | null): string => {
  const firstChar = titre.charAt(0);
  if (firstChar !== firstChar.toUpperCase() && procedureLibelle) {
    return `${procedureLibelle} ${titre}`;
  }
  return titre;
};

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
  amendements: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const etatLabels = DOSSIER_ETAT_CONFIG;

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const formatDateShort = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  en_cours:  { label: 'En cours',   color: 'text-amber-700',  dot: 'bg-amber-500' },
  adopte:    { label: 'Adopté',     color: 'text-blue-700',   dot: 'bg-blue-500' },
  rejete:    { label: 'Rejeté',     color: 'text-red-700',    dot: 'bg-red-500' },
  promulgue: { label: 'Promulgué',  color: 'text-green-700',  dot: 'bg-green-500' },
  caduc:     { label: 'Caduc',      color: 'text-muted-foreground',   dot: 'bg-muted-foreground' },
  retire:    { label: 'Retiré',     color: 'text-orange-700', dot: 'bg-orange-500' },
};

// ---------------------------------------------------------------------------
// Parliamentary Journey Timeline
// ---------------------------------------------------------------------------

// Builds fallback LegislativeStep[] from dossier etat data (for Sénat-only dossiers
// without actesLegislatifs, or any dossier where legislativeSteps is empty).
function buildFallbackSteps(
  dossiers: SujetDossier[],
  sujet: SujetDetail,
): LegislativeStep[] {
  const anDossiers = dossiers.filter(d => d.chambre === 'assemblee');
  const senatDossiers = dossiers.filter(d => d.chambre === 'senat');

  const allEtats = dossiers.map(d => d.etat).filter(Boolean);
  const hasPromulgue = allEtats.includes('promulgue');
  const hasAdopte = allEtats.includes('adopte');
  const allRejete = allEtats.length > 0 && allEtats.every(e => e === 'rejete');

  const depotDates = dossiers
    .map(d => d.dateDepot)
    .filter((d): d is string => d !== null)
    .sort();

  const etatToOutcome = (etat: string | null): LegislativeStep['outcome'] => {
    if (etat === 'adopte') return 'adopted';
    if (etat === 'rejete') return 'rejected';
    if (etat === 'promulgue') return 'adopted';
    return null;
  };

  const result: LegislativeStep[] = [];

  // Dépôt
  result.push({
    code: 'DEPOT',
    label: 'Dépôt',
    chambre: anDossiers.length > 0 && senatDossiers.length > 0 ? 'both' : anDossiers.length > 0 ? 'assemblee' : 'senat',
    status: 'done',
    outcome: null,
    date: depotDates[0] ?? null,
    detail: null,
  });

  if (sujet.matchMethod === 'cross_ref') {
    const anEtat = anDossiers[0]?.etat ?? null;
    const senatEtat = senatDossiers[0]?.etat ?? null;
    const anAdoption = anDossiers.find(d => d.dateAdoption)?.dateAdoption ?? null;
    const senatAdoption = senatDossiers.find(d => d.dateAdoption)?.dateAdoption ?? null;

    result.push({
      code: 'AN1',
      label: 'Assemblée nationale',
      chambre: 'assemblee',
      status: anEtat && anEtat !== 'en_cours' ? 'done' : anEtat === 'en_cours' ? 'active' : 'pending',
      outcome: etatToOutcome(anEtat),
      date: anAdoption,
      detail: anDossiers.length > 0 ? `${anDossiers.reduce((s, d) => s + d.scrutinCount, 0)} scrutins` : null,
    });

    result.push({
      code: 'SN1',
      label: 'Sénat',
      chambre: 'senat',
      status: senatEtat && senatEtat !== 'en_cours' ? 'done' : senatEtat === 'en_cours' ? 'active' : 'pending',
      outcome: etatToOutcome(senatEtat),
      date: senatAdoption,
      detail: senatDossiers.length > 0 ? `${senatDossiers.reduce((s, d) => s + d.scrutinCount, 0)} scrutins` : null,
    });

    if (hasPromulgue || hasAdopte) {
      result.push({
        code: 'ADOPT_DEF',
        label: 'Adoption définitive',
        chambre: 'both',
        status: 'done',
        outcome: 'adopted_definitive',
        date: null,
        detail: null,
      });
    } else if (!allRejete) {
      result.push({
        code: 'ADOPT_DEF',
        label: 'Adoption définitive',
        chambre: 'both',
        status: 'pending',
        outcome: null,
        date: null,
        detail: null,
      });
    }
  } else {
    // Solo — always show full journey: Examen → Adoption/Rejeté
    const chambre: 'assemblee' | 'senat' = anDossiers.length > 0 ? 'assemblee' : 'senat';
    const etat = dossiers[0]?.etat ?? null;
    const adoption = dossiers.find(d => d.dateAdoption)?.dateAdoption ?? null;
    const isDone = etat && etat !== 'en_cours';

    result.push({
      code: 'EXAM',
      label: 'Examen',
      chambre,
      status: isDone ? 'done' : 'active',
      outcome: null,
      date: sujet.dateDernierVote ?? null,
      detail: `${sujet.scrutinCount} scrutin${sujet.scrutinCount > 1 ? 's' : ''}`,
    });

    if (etat === 'rejete') {
      result.push({
        code: 'REJETE',
        label: 'Rejeté',
        chambre,
        status: 'done',
        outcome: 'rejected',
        date: adoption,
        detail: null,
      });
    } else {
      result.push({
        code: 'ADOPT',
        label: 'Adoption',
        chambre,
        status: isDone ? 'done' : 'pending',
        outcome: isDone ? etatToOutcome(etat) : null,
        date: isDone ? adoption : null,
        detail: null,
      });
    }
  }

  // Promulgation — always show as last step (done or pending), unless all rejected
  if (hasPromulgue) {
    const loiNumero = dossiers.find(d => d.loiNumero)?.loiNumero ?? null;
    const loiDateJO = dossiers.find(d => d.loiDateJO)?.loiDateJO ?? null;
    result.push({
      code: 'PROMULGATION',
      label: 'Promulgation',
      chambre: 'both',
      status: 'done',
      outcome: 'adopted',
      date: loiDateJO ?? sujet.dateFin ?? null,
      detail: loiNumero ? `Loi n°${loiNumero}` : null,
    });
  } else if (!allRejete) {
    result.push({
      code: 'PROMULGATION',
      label: 'Promulgation',
      chambre: 'both',
      status: 'pending',
      outcome: null,
      date: null,
      detail: null,
    });
  }

  return result;
}

function ParliamentaryTimeline({ dossiers, sujet }: { dossiers: SujetDossier[]; sujet: SujetDetail }) {
  // Prefer AN dossier (DLR prefix) for cross_ref sujets that have both AN and Sénat dossiers
  const dossierWithSteps =
    dossiers.find(d => d.uid.startsWith('DLR') && d.legislativeSteps.length > 0) ??
    dossiers.find(d => d.legislativeSteps.length > 0);

  const steps = useMemo(
    () => dossierWithSteps ? dossierWithSteps.legislativeSteps : buildFallbackSteps(dossiers, sujet),
    [dossierWithSteps, dossiers, sujet],
  );

  return <LegislativeTimeline steps={steps} />;
}

// ---------------------------------------------------------------------------
// Context Section — Law info (promulgué) or procedure info (en cours)
// ---------------------------------------------------------------------------

function ContextSection({ sujet, dossiers }: { sujet: SujetDetail; dossiers: SujetDossier[] }) {
  const loiDossier = dossiers.find(d => d.loiNumero);

  // Deduplicate external links by URL
  const uniqueLinks = (() => {
    const seen = new Set<string>();
    const links: Array<{ url: string; label: string; color: string }> = [];

    // Légifrance first
    for (const d of dossiers) {
      if (d.urlLegifrance && !seen.has(d.urlLegifrance)) {
        seen.add(d.urlLegifrance);
        links.push({ url: d.urlLegifrance, label: 'Consulter sur Légifrance', color: 'text-green-700 hover:text-green-800' });
      }
    }
    // AN — only from AN dossiers
    for (const d of dossiers.filter(d => d.chambre === 'assemblee')) {
      if (d.urlAN && !seen.has(d.urlAN)) {
        seen.add(d.urlAN);
        links.push({ url: d.urlAN, label: 'Dossier Assemblée nationale', color: 'text-purple-600 hover:text-purple-800' });
      }
    }
    // Sénat — only from Sénat dossiers
    for (const d of dossiers.filter(d => d.chambre === 'senat')) {
      if (d.urlSenat && !seen.has(d.urlSenat)) {
        seen.add(d.urlSenat);
        links.push({ url: d.urlSenat, label: 'Dossier Sénat', color: 'text-blue-600 hover:text-blue-800' });
      }
    }
    return links;
  })();

  const sections: React.ReactNode[] = [];

  // LLM-generated content (can coexist with law info)
  if (sujet.resume || sujet.enjeux) {
    sections.push(
      <div key="llm" className="rounded-lg border bg-card p-5 space-y-4">
        {sujet.resume && (
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4" />
              Résumé
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{sujet.resume}</p>
          </div>
        )}
        {sujet.enjeux && (
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <Scale className="h-4 w-4" />
              Enjeux
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{sujet.enjeux}</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground/60">
          Résumé généré par IA
        </p>
      </div>,
    );
  }

  // Promulgué — law card (same style as dossier page)
  if (sujet.status === 'promulgue' && loiDossier) {
    sections.push(
      <div key="loi" className="p-4 rounded-lg border border-green-500/30 bg-green-500/5 dark:bg-green-500/10">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-green-500/15 flex-shrink-0">
            <Scale className="h-5 w-5 text-green-500" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-green-500 uppercase tracking-wide">Loi promulguée</span>
            <p className="font-semibold">Loi n°{loiDossier.loiNumero}</p>
            {loiDossier.loiTitre && (
              <p className="text-sm text-muted-foreground">{loiDossier.loiTitre}</p>
            )}
            {loiDossier.loiDateJO && (
              <p className="text-xs text-muted-foreground mt-1">
                Publiée au JO le {formatDate(loiDossier.loiDateJO)}
              </p>
            )}
            {uniqueLinks.some(l => l.label.includes('Légifrance')) && (
              <div className="mt-3">
                {uniqueLinks.filter(l => l.label.includes('Légifrance')).map(link => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Consulter le texte de loi sur Légifrance
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>,
    );
  }

  // En cours — procedure info
  if (sujet.status === 'en_cours') {
    const procedure = dossiers.find(d => d.procedureLibelle)?.procedureLibelle;
    sections.push(
      <div key="en-cours" className="rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4" />
          Texte en cours d&apos;examen
        </h2>
        <div className="space-y-2">
          {procedure && (
            <p className="text-sm text-muted-foreground">
              Procédure : <span className="font-medium text-foreground">{procedure}</span>
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {sujet.scrutinCount} scrutin{sujet.scrutinCount > 1 ? 's' : ''} enregistré{sujet.scrutinCount > 1 ? 's' : ''}
            {sujet.dateDernierVote && <>, dernier vote le {formatDate(sujet.dateDernierVote)}</>}
          </p>
          {uniqueLinks.length > 0 && (
            <div className="flex flex-wrap gap-3 pt-1">
              {uniqueLinks.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 text-sm ${link.color} hover:underline`}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>,
    );
  }

  if (sections.length === 0) return null;

  return <div className="mb-8 space-y-4">{sections}</div>;
}

// ---------------------------------------------------------------------------
// Scrutins Panel
// ---------------------------------------------------------------------------

function ScrutinsPanel({ slug, totalScrutins }: { slug: string; totalScrutins: number }) {
  const [chambreFilter, setChambreFilter] = useState<string>('all');

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
  });

  const { loadMoreRef } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  const scrutins = scrutinsPages?.pages.flatMap((p) => p.data) ?? [];
  const filteredScrutins = chambreFilter === 'all'
    ? scrutins
    : scrutins.filter(s => s.chambre === chambreFilter);

  return (
    <div className="rounded-lg border bg-card flex flex-col min-h-0">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Vote className="h-4 w-4" />
          Scrutins
          <span className="text-xs font-normal text-muted-foreground">({totalScrutins})</span>
        </h2>
        <select
          value={chambreFilter}
          onChange={(e) => setChambreFilter(e.target.value)}
          className="text-xs border rounded-md px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">Toutes les chambres</option>
          <option value="assemblee">Assemblée Nationale</option>
          <option value="senat">Sénat</option>
        </select>
      </div>

      <div className="overflow-y-auto flex-1 max-h-[600px]">
        {filteredScrutins.length > 0 ? (
          <div className="divide-y">
            {filteredScrutins.map((scrutin) => {
              const total = scrutin.nombrePour + scrutin.nombreContre + scrutin.nombreAbstention;
              const pourPct = total > 0 ? (scrutin.nombrePour / total) * 100 : 0;
              const contrePct = total > 0 ? (scrutin.nombreContre / total) * 100 : 0;

              return (
                <Link
                  key={scrutin.id}
                  href={`/scrutins/${scrutin.numero}?chambre=${scrutin.chambre || 'assemblee'}${scrutin.chambre === 'senat' && scrutin.session ? `&session=${scrutin.session}` : ''}`}
                  className="block px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">{formatDateShort(scrutin.date)}</span>
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${scrutin.chambre === 'senat' ? 'badge-senat' : 'badge-assemblee'}`}>
                      {scrutin.chambre === 'senat' ? 'Sénat' : 'Assemblée Nationale'}
                    </span>
                    <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      scrutin.sort === 'adopte' ? 'badge-adopte' : 'badge-rejete'
                    }`}>
                      {scrutin.sort === 'adopte' ? 'Adopté' : 'Rejeté'}
                    </span>
                  </div>

                  <p className="text-sm font-medium leading-tight line-clamp-2 mb-2">
                    {scrutin.titre}
                  </p>

                  <div className="flex items-center gap-2">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden flex flex-1">
                      <div className="bg-green-500" style={{ width: `${pourPct}%` }} />
                      <div className="bg-red-500" style={{ width: `${contrePct}%` }} />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
                      <span className="text-green-600 font-medium">{scrutin.nombrePour}</span>
                      <span>/</span>
                      <span className="text-red-600 font-medium">{scrutin.nombreContre}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground text-sm">
            <Vote className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Aucun scrutin.
          </div>
        )}

        <div ref={loadMoreRef} className="py-3 flex justify-center">
          {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dossiers Panel
// ---------------------------------------------------------------------------

function DossiersPanel({ dossiers }: { dossiers: SujetDossier[] }) {
  if (dossiers.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card">
      <div className="px-4 py-3 border-b">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Dossiers législatifs
          <span className="text-xs font-normal text-muted-foreground">({dossiers.length})</span>
        </h2>
      </div>

      <div className="divide-y">
        {dossiers.map((dossier) => (
          <Link
            key={dossier.id}
            href={`/dossiers/${dossier.uid}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${dossier.chambre === 'senat' ? 'badge-senat' : 'badge-assemblee'}`}>
                  {dossier.chambre === 'senat' ? 'Sénat' : 'AN'}
                </span>
                {dossier.etat && etatLabels[dossier.etat] && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${etatLabels[dossier.etat].color}`}>
                    {etatLabels[dossier.etat].label}
                  </span>
                )}
                {dossier.loiNumero && (
                  <span className="text-[10px] font-medium text-green-700">
                    Loi n°{dossier.loiNumero}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium leading-tight line-clamp-2">
                {formatDossierTitre(dossier.titre, dossier.procedureLibelle)}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats Panel
// ---------------------------------------------------------------------------

function StatsPanel({ slug, dossiers }: { slug: string; dossiers: SujetDossier[] }) {
  const [sortBy, setSortBy] = useState<'votes' | 'chambre' | 'amendements'>('amendements');
  const [statsChambreFilter, setStatsChambreFilter] = useState<string>('all');

  const { data: statsData, isLoading } = useQuery<{ data: GroupeVoteStats[]; groupeAmendementDescriptions: Record<string, string> }>({
    queryKey: ['sujet-stats', slug],
    queryFn: () => api.get(`/sujets/${slug}/stats`).then((res) => res.data),
  });

  const groupeStats = statsData?.data ?? [];
  const groupeDescriptions = statsData?.groupeAmendementDescriptions ?? {};

  const sorted = useMemo(() => {
    let filtered = [...groupeStats];

    if (statsChambreFilter !== 'all') {
      filtered = filtered.filter(g => g.chambre === statsChambreFilter);
    }

    if (sortBy === 'votes') {
      filtered.sort((a, b) => {
        const totalA = a.votes.pour + a.votes.contre + a.votes.abstention + a.votes.absent;
        const totalB = b.votes.pour + b.votes.contre + b.votes.abstention + b.votes.absent;
        return totalB - totalA;
      });
    } else if (sortBy === 'chambre') {
      filtered.sort((a, b) => a.chambre.localeCompare(b.chambre) || a.nom.localeCompare(b.nom));
    } else if (sortBy === 'amendements') {
      filtered.sort((a, b) => b.amendements - a.amendements);
    }

    return filtered;
  }, [groupeStats, sortBy, statsChambreFilter]);

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 rounded bg-muted" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-2/3 rounded bg-muted" />
              <div className="h-2 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card flex flex-col min-h-0">
      <div className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Stats par groupe politique</h2>
        <div className="flex items-center gap-2">
          <select
            value={statsChambreFilter}
            onChange={(e) => setStatsChambreFilter(e.target.value)}
            className="text-xs border rounded-md px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Toutes les chambres</option>
            <option value="assemblee">Assemblée Nationale</option>
            <option value="senat">Sénat</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'votes' | 'chambre' | 'amendements')}
            className="text-xs border rounded-md px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="votes">Par votes (total)</option>
            <option value="chambre">Par chambre</option>
            <option value="amendements">Par amendements</option>
          </select>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 max-h-[600px] divide-y">
        {sorted.length > 0 ? sorted.map((groupe) => {
          const targetDossier = groupe.amendements > 0
            ? (dossiers.find(d => d.chambre === groupe.chambre) ?? dossiers[0])
            : null;

          const content = (
            <div className={`px-4 py-3 ${targetDossier ? 'hover:bg-muted/50 transition-colors' : ''}`}>
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: groupe.couleur }}
                />
                <span className="text-sm font-semibold truncate">{groupe.nom}</span>
                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded flex-shrink-0 ${
                  groupe.chambre === 'senat' ? 'badge-senat' : 'badge-assemblee'
                }`}>
                  {groupe.chambre === 'senat' ? 'Sénat' : 'Assemblée Nationale'}
                </span>
                {groupe.amendements > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">
                    {groupe.amendements} amendement{groupe.amendements > 1 ? 's' : ''} →
                  </span>
                )}
              </div>

              {groupeDescriptions[`${groupe.slug}-${groupe.chambre}`] && (
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {groupeDescriptions[`${groupe.slug}-${groupe.chambre}`]}
                </p>
              )}
            </div>
          );

          return targetDossier ? (
            <Link
              key={`${groupe.slug}-${groupe.chambre}`}
              href={`/dossiers/${targetDossier.uid}?groupe=${groupe.slug}&tab=amendements`}
              className="block"
            >
              {content}
            </Link>
          ) : (
            <div key={`${groupe.slug}-${groupe.chambre}`}>
              {content}
            </div>
          );
        }) : (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Aucune statistique disponible.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PageClient({ initialData }: { initialData?: { data: SujetDetail } }) {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const { data: sujetData, isLoading, error } = useQuery<{ data: SujetDetail }>({
    queryKey: ['sujet', slug],
    queryFn: () => api.get(`/sujets/${slug}`).then((res) => res.data),
    initialData,
  });
  const sujet = sujetData?.data;

  const { data: dossiersData } = useQuery<PaginatedResponse<SujetDossier>>({
    queryKey: ['sujet-dossiers', slug],
    queryFn: () => api.get(`/sujets/${slug}/dossiers`, { params: { limit: 50 } }).then((res) => res.data),
    enabled: !!sujet,
  });

  const dossiers = dossiersData?.data ?? [];

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-6 w-1/3 rounded bg-muted" />
          <div className="h-8 w-2/3 rounded bg-muted" />
          <div className="h-24 rounded-lg bg-muted" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 rounded-lg bg-muted" />
            <div className="h-64 rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !sujet) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Sujet non trouvé.
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[sujet.status] ?? STATUS_CONFIG.en_cours;

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
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {/* Global status */}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-full bg-card border ${statusCfg.color}`}>
            <span className={`h-2 w-2 rounded-full ${statusCfg.dot}`} />
            {statusCfg.label}
          </span>
          {sujet.category && (
            <span className="px-3 py-1 text-sm font-medium badge-important rounded-full">
              {sujet.category}
            </span>
          )}
        </div>

        <h1 className="text-2xl md:text-3xl font-bold mb-3">{sujet.label}</h1>

        {/* Key dates */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
          {sujet.dateDebut && (
            <span>Déposé le {formatDate(sujet.dateDebut)}</span>
          )}
          {sujet.dateDebut && sujet.dateDernierVote && <span>•</span>}
          {sujet.dateDernierVote && (
            <span>Dernier vote le {formatDate(sujet.dateDernierVote)}</span>
          )}
          {(sujet.dateDebut || sujet.dateDernierVote) && sujet.dateFin && sujet.status === 'promulgue' && <span>•</span>}
          {sujet.dateFin && sujet.status === 'promulgue' && (
            <span className="text-green-700 font-medium">Promulgué le {formatDate(sujet.dateFin)}</span>
          )}
        </div>
      </div>

      {/* Parliamentary journey timeline */}
      {dossiers.length > 0 && (
        <div className="mb-8">
          <ParliamentaryTimeline dossiers={dossiers} sujet={sujet} />
        </div>
      )}

      {/* Context section — law info or procedure info */}
      <ContextSection sujet={sujet} dossiers={dossiers} />

      {/* Dashboard: mobile order = Dossiers → Stats → Scrutins; desktop = 2 cols */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="order-1 lg:col-start-1">
          <DossiersPanel dossiers={dossiers} />
        </div>
        <div className="order-2 lg:order-none lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <StatsPanel slug={slug} dossiers={dossiers} />
        </div>
        <div className="order-3 lg:col-start-1">
          <ScrutinsPanel slug={slug} totalScrutins={sujet.scrutinCount} />
        </div>
      </div>
    </div>
  );
}
