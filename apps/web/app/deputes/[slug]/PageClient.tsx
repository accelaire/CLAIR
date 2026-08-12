'use client';

import { useState } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { ExpandableAmendementCard } from '@/components/ExpandableAmendementCard';
import { FicheCompareCallout } from '@/components/FicheCompareCallout';
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
  ShieldCheck,
  Vote,
  MessageSquare,
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Loader2,  AlertTriangle,
  Sparkles,
  Shield,
  ExternalLink,
  Info,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DidacticielTooltip } from '@/components/ui/didacticiel-tooltip';
import { api } from '@/lib/api';
import { scrutinHref } from '@/lib/scrutin-url';
import { DateRangePicker, dateRangeToParams } from '@/components/DateRangePicker';
import { useUrlDateRange } from '@/hooks/useUrlFilters';
import { InterventionsList } from '@/components/parlementaire/interventions-list';
import { MandatsBlock } from '@/components/parlementaire/mandats-timeline';

export interface DeputeDetail {
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
  // Enrichissement IA
  resumeIA?: string | null;
  parcoursIA?: string | null;
  positionsClesIA?: string | null;
  faitsNotablesIA?: string | null;
  iaGeneratedAt?: string | null;
  // Mandats (organes / commissions)
  mandats?: Array<{
    id: string;
    typeOrgane: string;
    institution: string | null;
    qualite: string | null;
    dateDebut: string;
    dateFin: string | null;
    commission?: { slug: string; nom: string; chambre: string } | null;
  }>;
  // Mandats parlementaires (parcours par législature : groupe + circonscription)
  mandatsParlementaires?: Array<{
    legislature: number | null;
    mandature: number | null;
    dateDebut: string;
    dateFin: string | null;
    groupe: { slug: string; nom: string; couleur: string | null; legislature: number | null } | null;
    circonscription: { nom: string; departement: string; numero: number } | null;
  }>;
  // Déclarations HATVP
  declarations?: Array<{
    id: string;
    typeDocument: string;
    datePublication: string | null;
    urlDossier: string | null;
    statut: string | null;
  }>;
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
  tooltip,
  tooltipHref,
}: {
  label: string;
  value: number | string | null;
  icon: LucideIcon;
  suffix?: string;
  subtitle?: string;
  tooltip?: string;
  tooltipHref?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
        {tooltip && (
          <DidacticielTooltip content={tooltip} learnMoreHref={tooltipHref} />
        )}
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
    pour: { label: 'Pour', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: ThumbsUp },
    contre: { label: 'Contre', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: ThumbsDown },
    abstention: { label: 'Abstention', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Minus },
    absent: { label: 'Absent', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400', icon: Minus },
  }[position] || { label: position, className: 'bg-muted text-muted-foreground', icon: Minus };

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
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
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          placeholder="Filtrer par période"
          resultCount={total}
        />
        <button
          onClick={() => setVotedOnly(!votedOnly)}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            votedOnly
              ? 'bg-indigo-100 border-indigo-300 text-indigo-700 hover:bg-indigo-200'
              : 'bg-background border-input hover:bg-accent'
          }`}
        >
          <Vote className={`h-4 w-4 ${votedOnly ? 'text-indigo-600' : 'text-muted-foreground'}`} />
          Votes publics
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
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          placeholder="Filtrer par période"
          resultCount={total}
        />
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
            <span className="px-1.5 py-0.5 rounded bg-orange-200 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 text-xs">
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
            href={scrutinHref(vote.scrutin)}
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
                  <span className={vote.scrutin.sort === 'adopte' ? 'text-adopte' : 'text-rejete'}>
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

export default function PageClient({ initialData }: { initialData?: DeputeDetail }) {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [activeTab, setActiveTab] = useState<'votes' | 'interventions' | 'amendements'>('votes');
  const [showAnciensMandats, setShowAnciensMandats] = useState(false);
  const [showAllMandats, setShowAllMandats] = useState(false);
  const [showAllDeclarations, setShowAllDeclarations] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['depute', slug],
    queryFn: () =>
      api
        .get(`/deputes/${slug}`, { params: { include: 'stats' } })
        .then((res) => res.data.data as DeputeDetail),
    enabled: !!slug,
    initialData,
  });

  if (isLoading && !initialData) {
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
              icon={ShieldCheck}
              tooltip="Pourcentage de scrutins solennels auxquels ce parlementaire a participé (voté pour, contre ou abstention)."
              tooltipHref="/comprendre/parlementaire"
            />
            <StatCard
              label="Loyauté au groupe"
              value={depute.stats.loyaute}
              suffix="%"
              icon={Users}
              tooltip="Pourcentage de votes alignés avec la position majoritaire du groupe politique."
              tooltipHref="/comprendre/parlementaire"
            />
            <StatCard
              label="Votes"
              value={depute.stats.participation}
              icon={Vote}
              tooltip="Nombre total de scrutins publics auxquels ce parlementaire a pris part."
              tooltipHref="/comprendre/parlementaire"
            />
            <StatCard
              label="Interventions"
              value={depute.stats.interventions}
              icon={MessageSquare}
              tooltip="Nombre de prises de parole en séance publique."
              tooltipHref="/comprendre/parlementaire"
            />
          </div>
        </div>
      )}

      {/* Mandats et fonctions */}
      {((depute.mandats?.length ?? 0) > 0 ||
        (depute.mandatsParlementaires?.length ?? 0) > 0) && (
        <div className="mb-8">
          {/* Mandats : frise des législatures + fonctions en commission rattachées */}
          {(() => {
            const mandatsActifs = (depute.mandats ?? []).filter((m) => !m.dateFin);
            const mandatsAnciens = (depute.mandats ?? []).filter((m) => !!m.dateFin);
            const renderMandat = (m: NonNullable<typeof depute.mandats>[0]) => {
              const commissionLabel = m.commission?.nom || m.institution || m.typeOrgane;
              const commissionHref = m.commission ? `/commissions/${m.commission.slug}` : null;
              return (
                <div key={m.id} className="flex items-start gap-3 rounded-lg border bg-card p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{m.qualite || 'Membre'}</p>
                    {commissionHref ? (
                      <Link href={commissionHref} className="text-sm text-primary hover:underline line-clamp-2">
                        {commissionLabel}
                      </Link>
                    ) : (
                      <p className="text-sm text-muted-foreground">{commissionLabel}</p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground text-right flex-shrink-0">
                    <p>{new Date(m.dateDebut).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</p>
                    <p>{m.dateFin ? new Date(m.dateFin).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : 'en cours'}</p>
                  </div>
                </div>
              );
            };

            // Fonctions en commission : accordéons « Voir N de plus » / « Anciens
            // mandats » conservés tels quels, simplement rattachés à la période.
            const fonctions = (depute.mandats?.length ?? 0) > 0 ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  {showAllMandats
                    ? mandatsActifs.map(renderMandat)
                    : mandatsActifs.slice(0, 4).map(renderMandat)}
                </div>
                {mandatsActifs.length > 4 && (
                  <div className="mt-2">
                    <button
                      onClick={() => setShowAllMandats(!showAllMandats)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showAllMandats ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" />
                          Réduire
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" />
                          Voir {mandatsActifs.length - 4} de plus
                        </>
                      )}
                    </button>
                  </div>
                )}
                {mandatsAnciens.length > 0 && (
                  <div className="mt-3">
                    <button
                      onClick={() => setShowAnciensMandats((v) => !v)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAnciensMandats ? 'rotate-180' : ''}`} />
                      Anciens mandats ({mandatsAnciens.length})
                    </button>
                    {showAnciensMandats && (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 opacity-70">
                        {mandatsAnciens.map(renderMandat)}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : null;

            return (
              <MandatsBlock
                mandats={depute.mandatsParlementaires ?? []}
                chambre="assemblee"
                fonctionsCourantes={fonctions}
              />
            );
          })()}
        </div>
      )}

      <FicheCompareCallout variant="parlementaire" chambre="assemblee" slug={depute.slug} />

      {/* Fiche enrichie par IA */}
      {depute.resumeIA && (
        <div className="mb-8 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <h2 className="text-xl font-semibold">Fiche parlementaire</h2>
            <span className="text-xs text-muted-foreground">
              {depute.iaGeneratedAt && `Mise à jour le ${new Date(depute.iaGeneratedAt).toLocaleDateString('fr-FR')} - `}
              <Link href="/methodologie#enrichissement-ia" className="inline-flex items-center gap-1 align-baseline hover:underline">
                <Info className="h-3 w-3" />
                Généré par IA
              </Link>
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Résumé */}
            <div className="rounded-lg border bg-card p-5">
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">En bref</h3>
              <p className="text-sm leading-relaxed">{depute.resumeIA}</p>
            </div>

            {/* Parcours */}
            {depute.parcoursIA && (
              <div className="rounded-lg border bg-card p-5">
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Parcours</h3>
                <p className="text-sm leading-relaxed">{depute.parcoursIA}</p>
              </div>
            )}

            {/* Positions clés */}
            {depute.positionsClesIA && (
              <div className="rounded-lg border bg-card p-5">
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Positions clés</h3>
                <p className="text-sm leading-relaxed">{depute.positionsClesIA}</p>
              </div>
            )}

            {/* Faits notables */}
            {depute.faitsNotablesIA && (
              <div className="rounded-lg border bg-card p-5">
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Faits notables</h3>
                <p className="text-sm leading-relaxed">{depute.faitsNotablesIA}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Déclarations HATVP */}
      {depute.declarations && depute.declarations.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-emerald-500" />
            <h2 className="text-xl font-semibold">Transparence HATVP</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(showAllDeclarations ? depute.declarations : depute.declarations.slice(0, 4)).map((d) => {
              const labels: Record<string, string> = {
                di: "Déclaration d'intérêts",
                dia: "Déclaration d'intérêts et d'activités",
                diam: "Déclaration d'intérêts (modification)",
                dsp: 'Déclaration de patrimoine',
                dspm: 'Déclaration de patrimoine (modification)',
                dspfm: 'Déclaration de patrimoine (fin de mandat)',
              };
              return (
                <div key={d.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{labels[d.typeDocument] || d.typeDocument}</p>
                    {d.datePublication && (
                      <p className="text-xs text-muted-foreground">
                        Publiée le {new Date(d.datePublication).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                  {d.urlDossier && (
                    <a
                      href={d.urlDossier}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 rounded-lg border p-2 hover:bg-accent transition-colors"
                      title="Voir sur hatvp.fr"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
          {depute.declarations.length > 4 && (
            <div className="mt-2">
              <button
                onClick={() => setShowAllDeclarations(!showAllDeclarations)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAllDeclarations ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    Réduire
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    Voir {depute.declarations.length - 4} de plus
                  </>
                )}
              </button>
            </div>
          )}
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
        {activeTab === 'interventions' && <InterventionsList slug={depute.slug} chambre="assemblee" />}
        {activeTab === 'amendements' && <AmendementsList slug={depute.slug} />}
      </div>
    </div>
  );
}
