'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, Calendar, Vote, Loader2, CheckCircle, XCircle,
  Layers, ExternalLink, Scale, BookOpen,
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

function ParliamentaryTimeline({ dossiers, sujet }: { dossiers: SujetDossier[]; sujet: SujetDetail }) {
  const anDossiers = dossiers.filter(d => d.chambre === 'assemblee');
  const senatDossiers = dossiers.filter(d => d.chambre === 'senat');

  const steps = useMemo(() => {
    const result: Array<{
      label: string;
      chambre: 'assemblee' | 'senat' | 'both';
      status: 'done' | 'active' | 'pending';
      date?: string;
      detail?: string;
    }> = [];

    const allEtats = dossiers.map(d => d.etat).filter(Boolean);
    const hasPromulgue = allEtats.includes('promulgue');
    const hasAdopte = allEtats.includes('adopte');
    const allRejete = allEtats.length > 0 && allEtats.every(e => e === 'rejete');

    const depotDates = dossiers
      .map(d => d.dateDepot)
      .filter((d): d is string => d !== null)
      .sort();

    // Dépôt
    result.push({
      label: 'Dépôt',
      chambre: anDossiers.length > 0 && senatDossiers.length > 0 ? 'both' : anDossiers.length > 0 ? 'assemblee' : 'senat',
      status: 'done',
      date: depotDates[0] ? formatDateShort(depotDates[0]) : undefined,
    });

    if (sujet.matchMethod === 'cross_ref') {
      const anEtat = anDossiers[0]?.etat;
      const senatEtat = senatDossiers[0]?.etat;
      const anAdoption = anDossiers.find(d => d.dateAdoption)?.dateAdoption;
      const senatAdoption = senatDossiers.find(d => d.dateAdoption)?.dateAdoption;

      result.push({
        label: 'Assemblée nationale',
        chambre: 'assemblee',
        status: anEtat && anEtat !== 'en_cours' ? 'done' : anEtat === 'en_cours' ? 'active' : 'pending',
        date: anAdoption ? formatDateShort(anAdoption) : undefined,
        detail: anDossiers.length > 0 ? `${anDossiers.reduce((s, d) => s + d.scrutinCount, 0)} scrutins` : undefined,
      });

      result.push({
        label: 'Sénat',
        chambre: 'senat',
        status: senatEtat && senatEtat !== 'en_cours' ? 'done' : senatEtat === 'en_cours' ? 'active' : 'pending',
        date: senatAdoption ? formatDateShort(senatAdoption) : undefined,
        detail: senatDossiers.length > 0 ? `${senatDossiers.reduce((s, d) => s + d.scrutinCount, 0)} scrutins` : undefined,
      });

      if (hasPromulgue || hasAdopte) {
        result.push({
          label: 'Adoption définitive',
          chambre: 'both',
          status: 'done',
        });
      } else if (!allRejete) {
        result.push({
          label: 'Adoption définitive',
          chambre: 'both',
          status: 'pending',
        });
      }
    } else {
      // Solo — always show full journey: Examen → Adoption → Promulgation
      const chambre = anDossiers.length > 0 ? 'assemblee' : 'senat';
      const etat = dossiers[0]?.etat;
      const adoption = dossiers.find(d => d.dateAdoption)?.dateAdoption;
      const isDone = etat && etat !== 'en_cours';

      result.push({
        label: 'Examen',
        chambre: chambre as 'assemblee' | 'senat',
        status: isDone ? 'done' : 'active',
        date: sujet.dateDernierVote ? formatDateShort(sujet.dateDernierVote) : undefined,
        detail: `${sujet.scrutinCount} scrutin${sujet.scrutinCount > 1 ? 's' : ''}`,
      });

      if (etat === 'rejete') {
        result.push({
          label: 'Rejeté',
          chambre: chambre as 'assemblee' | 'senat',
          status: 'done',
          date: adoption ? formatDateShort(adoption) : undefined,
        });
      } else {
        result.push({
          label: 'Adoption',
          chambre: chambre as 'assemblee' | 'senat',
          status: isDone ? 'done' : 'pending',
          date: isDone && adoption ? formatDateShort(adoption) : undefined,
        });
      }
    }

    // Promulgation — always show as last step (done or pending)
    if (hasPromulgue) {
      const loiNumero = dossiers.find(d => d.loiNumero)?.loiNumero;
      const loiDateJO = dossiers.find(d => d.loiDateJO)?.loiDateJO;
      result.push({
        label: 'Promulgation',
        chambre: 'both',
        status: 'done',
        date: loiDateJO ? formatDateShort(loiDateJO) : sujet.dateFin ? formatDateShort(sujet.dateFin) : undefined,
        detail: loiNumero ? `Loi n°${loiNumero}` : undefined,
      });
    } else if (!allRejete) {
      result.push({
        label: 'Promulgation',
        chambre: 'both',
        status: 'pending',
      });
    }

    return result;
  }, [dossiers, anDossiers, senatDossiers, sujet]);

  const chambreLabel = (chambre: string) => {
    if (chambre === 'assemblee') return 'AN';
    if (chambre === 'senat') return 'Sénat';
    return 'AN + Sénat';
  };

  const chambreColor = (chambre: string) => {
    if (chambre === 'assemblee') return 'badge-assemblee border border-purple-300 dark:border-purple-800';
    if (chambre === 'senat') return 'badge-senat border border-blue-300 dark:border-blue-800';
    return 'border-primary/30 bg-primary/5 text-primary';
  };

  const dotColor = (status: string) => {
    if (status === 'done') return 'bg-green-500 ring-green-200';
    if (status === 'active') return 'bg-amber-500 ring-amber-200 animate-pulse';
    return 'bg-muted ring-border';
  };

  return (
    <div className="rounded-lg border bg-card p-5">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-5">
        Parcours parlementaire
      </h2>

      <div className="overflow-x-auto pt-1 pb-2 -mx-1 px-1">
        <div className="flex items-start" style={{ minWidth: `${steps.length * 120}px` }}>
          {steps.map((step, i) => {
            const nextStep = steps[i + 1];
            const lineColor = !nextStep ? '' :
              nextStep.status === 'done' ? 'bg-green-400' :
              nextStep.status === 'active' ? 'bg-amber-400' : '';

            return (
              <div key={i} className="flex items-start flex-1 last:flex-none">
                {/* Step column */}
                <div className="flex flex-col items-center flex-shrink-0" style={{ minWidth: '80px' }}>
                  <div className={`h-4 w-4 rounded-full ring-4 ${dotColor(step.status)}`} />
                  <span className={`mt-2.5 text-[11px] font-semibold text-center leading-tight whitespace-nowrap ${
                    step.status === 'pending' ? 'text-muted-foreground/40' : 'text-foreground'
                  }`}>
                    {step.label}
                  </span>
                  {step.date && (
                    <span className="mt-0.5 text-[10px] text-muted-foreground font-medium">
                      {step.date}
                    </span>
                  )}
                  <span className={`mt-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded border ${chambreColor(step.chambre)} ${
                    step.status === 'pending' ? 'opacity-30' : ''
                  }`}>
                    {chambreLabel(step.chambre)}
                  </span>
                  {step.detail && (
                    <span className="mt-1 text-[10px] text-muted-foreground text-center">
                      {step.detail}
                    </span>
                  )}
                </div>

                {/* Connector line */}
                {nextStep && (
                  <div className="flex items-center self-start pt-[7px] mx-1 flex-1 min-w-[20px]">
                    {nextStep.status === 'pending' ? (
                      <div className="h-0.5 w-full border-t-2 border-dashed border-border" />
                    ) : (
                      <div className={`h-0.5 w-full rounded-full ${lineColor}`} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
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
      <div key="loi" className="p-4 rounded-lg border border-green-200 bg-green-50/50">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-green-100 flex-shrink-0">
            <Scale className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-green-600 uppercase tracking-wide">Loi promulguée</span>
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

  return (
    <div className="rounded-lg border bg-card flex flex-col min-h-0">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Vote className="h-4 w-4" />
          Scrutins
          <span className="text-xs font-normal text-muted-foreground">({totalScrutins})</span>
        </h2>
      </div>

      <div className="overflow-y-auto flex-1 max-h-[600px]">
        {scrutins.length > 0 ? (
          <div className="divide-y">
            {scrutins.map((scrutin) => {
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
                      {scrutin.chambre === 'senat' ? 'Sénat' : 'AN'}
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
  const { data: statsData, isLoading } = useQuery<{ data: GroupeVoteStats[] }>({
    queryKey: ['sujet-stats', slug],
    queryFn: () => api.get(`/sujets/${slug}/stats`).then((res) => res.data),
  });

  const groupeStats = statsData?.data ?? [];

  const sorted = useMemo(() =>
    [...groupeStats].sort((a, b) => {
      const totalA = a.votes.pour + a.votes.contre + a.votes.abstention + a.votes.absent;
      const totalB = b.votes.pour + b.votes.contre + b.votes.abstention + b.votes.absent;
      return totalB - totalA;
    }),
  [groupeStats]);

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
      <div className="px-4 py-3 border-b">
        <h2 className="text-sm font-semibold">Stats par groupe</h2>
      </div>

      <div className="overflow-y-auto flex-1 max-h-[600px] divide-y">
        {sorted.length > 0 ? sorted.map((groupe) => {
          const totalVotes = groupe.votes.pour + groupe.votes.contre + groupe.votes.abstention;
          const pourPct = totalVotes > 0 ? (groupe.votes.pour / totalVotes) * 100 : 0;
          const contrePct = totalVotes > 0 ? (groupe.votes.contre / totalVotes) * 100 : 0;
          const abstPct = totalVotes > 0 ? (groupe.votes.abstention / totalVotes) * 100 : 0;

          return (
            <div key={`${groupe.slug}-${groupe.chambre}`} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: groupe.couleur }}
                />
                <span className="text-sm font-medium truncate">{groupe.nom}</span>
                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded flex-shrink-0 ${
                  groupe.chambre === 'senat' ? 'badge-senat' : 'badge-assemblee'
                }`}>
                  {groupe.chambre === 'senat' ? 'Sénat' : 'AN'}
                </span>
              </div>

              <div className="h-2 rounded-full bg-muted overflow-hidden flex mb-2">
                <div className="bg-green-500 transition-all" style={{ width: `${pourPct}%` }} />
                <div className="bg-red-500 transition-all" style={{ width: `${contrePct}%` }} />
                <div className="bg-yellow-400 transition-all" style={{ width: `${abstPct}%` }} />
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="text-green-600">{groupe.votes.pour.toLocaleString('fr-FR')} pour</span>
                <span className="text-red-600">{groupe.votes.contre.toLocaleString('fr-FR')} contre</span>
                <span className="text-yellow-600">{groupe.votes.abstention.toLocaleString('fr-FR')} abst.</span>
                <span className="ml-auto">{groupe.votes.absent.toLocaleString('fr-FR')} abs.</span>
              </div>
              {groupe.amendements > 0 && (() => {
                const targetDossier = dossiers.find(d => d.chambre === groupe.chambre) ?? dossiers[0];
                return targetDossier ? (
                  <Link
                    href={`/dossiers/${targetDossier.uid}?groupe=${groupe.slug}&tab=amendements`}
                    className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {groupe.amendements.toLocaleString('fr-FR')} amendement{groupe.amendements > 1 ? 's' : ''} déposé{groupe.amendements > 1 ? 's' : ''}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : (
                  <div className="mt-1.5 text-xs text-muted-foreground">
                    {groupe.amendements.toLocaleString('fr-FR')} amendement{groupe.amendements > 1 ? 's' : ''} déposé{groupe.amendements > 1 ? 's' : ''}
                  </div>
                );
              })()}
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

export default function SujetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const { data: sujetData, isLoading, error } = useQuery<{ data: SujetDetail }>({
    queryKey: ['sujet', slug],
    queryFn: () => api.get(`/sujets/${slug}`).then((res) => res.data),
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

        {sujet.description && (
          <p className="text-muted-foreground mb-3">{sujet.description}</p>
        )}

        {/* Key dates */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {sujet.dateDebut && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              Déposé le {formatDate(sujet.dateDebut)}
            </span>
          )}
          {sujet.dateDernierVote && (
            <span className="flex items-center gap-1.5">
              <Vote className="h-4 w-4" />
              Dernier vote le {formatDate(sujet.dateDernierVote)}
            </span>
          )}
          {sujet.dateFin && sujet.status === 'promulgue' && (
            <span className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Promulgué le {formatDate(sujet.dateFin)}
            </span>
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

      {/* Two-panel dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Dossiers + Scrutins */}
        <div className="space-y-6">
          <DossiersPanel dossiers={dossiers} />
          <ScrutinsPanel slug={slug} totalScrutins={sujet.scrutinCount} />
        </div>

        {/* Right: Stats */}
        <div>
          <StatsPanel slug={slug} dossiers={dossiers} />
        </div>
      </div>
    </div>
  );
}
