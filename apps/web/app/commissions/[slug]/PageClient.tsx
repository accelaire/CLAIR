'use client';

import { useState, Suspense } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Users,
  Calendar,
  MapPin,
  Clock,
  Building2,
  ChevronRight,
  Loader2,
  Video,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

export interface CommissionDetail {
  id: string;
  uid: string;
  slug: string;
  chambre: string;
  type: string;
  nom: string;
  nomCourt: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  actif: boolean;
  nbMembres: number;
  nbReunions: number;
  membres: Array<{
    qualite: string | null;
    parlementaire: {
      id: string;
      slug: string;
      nom: string;
      prenom: string;
      photoUrl: string | null;
      chambre: string;
      groupe: {
        nom: string;
        couleur: string | null;
        slug: string;
      } | null;
    };
  }>;
  prochainesReunions: Array<{
    id: string;
    uid: string;
    dateDebut: string;
    dateFin: string | null;
    lieu: string | null;
    odjResume: string | null;
    etat: string | null;
  }>;
}

interface Reunion {
  id: string;
  uid: string;
  dateDebut: string;
  dateFin: string | null;
  lieu: string | null;
  odjResume: string | null;
  etat: string | null;
  captationVideo: boolean | null;
  nbParticipants: number;
}

interface ReunionsResponse {
  data: Reunion[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const CHAMBRE_LABELS: Record<string, string> = {
  assemblee: 'Assemblée nationale',
  senat: 'Sénat',
};

const TYPE_LABELS: Record<string, string> = {
  permanente: 'Permanente',
  enquete: "Enquête",
  speciale: 'Spéciale',
  mixte_paritaire: 'Mixte paritaire',
  autre: 'Autre',
};

const QUALITE_ORDER = ['Président', 'Présidente', 'Vice-Président', 'Vice-Présidente'];

function qualiteOrder(q: string | null): number {
  if (!q) return 99;
  for (let i = 0; i < QUALITE_ORDER.length; i++) {
    if (q.includes(QUALITE_ORDER[i]!)) return i;
  }
  return 10;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function QualiteBadge({ qualite }: { qualite: string | null }) {
  if (!qualite || qualite.toLowerCase() === 'membre') return null;
  const order = qualiteOrder(qualite);
  const isPresident = order <= 1;
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium border ${
        isPresident
          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700'
          : 'bg-muted text-muted-foreground border-border'
      }`}
    >
      {qualite}
    </span>
  );
}

function ReunionItem({ reunion }: { reunion: { id: string; uid: string; dateDebut: string; dateFin: string | null; lieu: string | null; odjResume: string | null; etat: string | null; captationVideo?: boolean | null; nbParticipants?: number } }) {
  return (
    <div className='rounded-lg border bg-card p-4'>
      <div className='flex items-start justify-between gap-3'>
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-2 text-sm font-medium mb-1'>
            <Clock className='h-3.5 w-3.5 text-muted-foreground shrink-0' />
            <span className='capitalize'>{formatDate(reunion.dateDebut)}</span>
            <span className='text-muted-foreground'>·</span>
            <span className='text-muted-foreground'>{formatTime(reunion.dateDebut)}</span>
            {reunion.dateFin && (
              <span className='text-muted-foreground'>— {formatTime(reunion.dateFin)}</span>
            )}
          </div>
          {reunion.odjResume && (
            <p className='text-sm text-muted-foreground line-clamp-2'>{reunion.odjResume}</p>
          )}
          {reunion.lieu && (
            <p className='mt-1 flex items-center gap-1 text-xs text-muted-foreground'>
              <MapPin className='h-3 w-3' />
              {reunion.lieu}
            </p>
          )}
        </div>
        <div className='flex flex-col items-end gap-1 shrink-0'>
          {reunion.captationVideo && (
            <span className='flex items-center gap-1 px-2 py-0.5 rounded text-xs border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800'>
              <Video className='h-3 w-3' />
              Vidéo
            </span>
          )}
          {reunion.nbParticipants !== undefined && reunion.nbParticipants > 0 && (
            <span className='text-xs text-muted-foreground'>
              {reunion.nbParticipants} participants
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab Membres ──
function TabMembres({ commission }: { commission: CommissionDetail }) {
  const sorted = [...commission.membres].sort(
    (a, b) => qualiteOrder(a.qualite) - qualiteOrder(b.qualite),
  );

  if (sorted.length === 0) {
    return (
      <div className='py-12 text-center text-muted-foreground'>
        Aucun membre enregistré pour cette commission.
      </div>
    );
  }

  return (
    <div className='space-y-2'>
      {sorted.map(({ qualite, parlementaire }) => {
        const isDeputy = parlementaire.chambre === 'assemblee' || parlementaire.chambre === 'depute';
        const href = isDeputy
          ? `/deputes/${parlementaire.slug}`
          : `/senateurs/${parlementaire.slug}`;
        return (
          <Link
            key={parlementaire.id}
            href={href}
            className='group flex items-center gap-4 rounded-lg border bg-card p-3 transition-all hover:border-primary hover:shadow-sm'
          >
            {/* Photo */}
            <div className='relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-muted'>
              {parlementaire.photoUrl ? (
                <Image
                  src={parlementaire.photoUrl}
                  alt={`${parlementaire.prenom} ${parlementaire.nom}`}
                  fill
                  className='object-cover'
                  unoptimized
                />
              ) : (
                <Users className='absolute inset-0 m-auto h-6 w-6 text-muted-foreground' />
              )}
            </div>

            {/* Infos */}
            <div className='flex-1 min-w-0'>
              <div className='flex items-center gap-2 flex-wrap'>
                <span className='font-medium group-hover:text-primary transition-colors'>
                  {parlementaire.prenom} {parlementaire.nom}
                </span>
                <QualiteBadge qualite={qualite} />
              </div>
              {parlementaire.groupe && (
                <div className='mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground'>
                  <span
                    className='h-2 w-2 rounded-full shrink-0'
                    style={{ backgroundColor: parlementaire.groupe.couleur || '#888' }}
                  />
                  <span className='truncate'>{parlementaire.groupe.nom}</span>
                </div>
              )}
            </div>

            <ChevronRight className='h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0' />
          </Link>
        );
      })}
    </div>
  );
}

// ── Tab Agenda ──
function TabAgenda({ commission }: { commission: CommissionDetail }) {
  if (commission.prochainesReunions.length === 0) {
    return (
      <div className='py-12 text-center text-muted-foreground'>
        Aucune réunion à venir enregistrée pour cette commission.
      </div>
    );
  }

  return (
    <div className='space-y-3'>
      <p className='text-sm text-muted-foreground mb-4'>
        {commission.prochainesReunions.length} prochaine{commission.prochainesReunions.length > 1 ? 's' : ''} réunion{commission.prochainesReunions.length > 1 ? 's' : ''}
      </p>
      {commission.prochainesReunions.map((reunion) => (
        <ReunionItem key={reunion.id} reunion={reunion} />
      ))}
    </div>
  );
}

// ── Tab Historique ──
function TabHistorique({ slug }: { slug: string }) {
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<ReunionsResponse>({
    queryKey: ['commission-reunions', slug, 'passees'],
    queryFn: ({ pageParam = 1 }) =>
      api
        .get(`/commissions/${slug}/reunions`, {
          params: { passees: 'true', page: pageParam, limit: 20 },
        })
        .then((res) => res.data),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.totalPages
        ? lastPage.pagination.page + 1
        : undefined,
    initialPageParam: 1,
  });

  const { loadMoreRef } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  const reunions = data?.pages.flatMap((p) => p.data) ?? [];
  const total = data?.pages[0]?.pagination.total ?? 0;

  if (isLoading) {
    return (
      <div className='space-y-3'>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className='animate-pulse rounded-lg border bg-card p-4'>
            <div className='h-4 w-1/2 rounded bg-muted mb-2' />
            <div className='h-3 w-3/4 rounded bg-muted' />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className='rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive'>
        Erreur lors du chargement des réunions passées.
      </div>
    );
  }

  if (reunions.length === 0) {
    return (
      <div className='py-12 text-center text-muted-foreground'>
        Aucune réunion passée enregistrée pour cette commission.
      </div>
    );
  }

  return (
    <div>
      <p className='mb-4 text-sm text-muted-foreground'>
        {total.toLocaleString('fr-FR')} réunion{total > 1 ? 's' : ''} enregistrée{total > 1 ? 's' : ''}
      </p>
      <div className='space-y-3'>
        {reunions.map((reunion) => (
          <ReunionItem key={reunion.id} reunion={reunion} />
        ))}
      </div>
      <div ref={loadMoreRef} className='mt-6 flex justify-center py-4'>
        {isFetchingNextPage && (
          <div className='flex items-center gap-2 text-muted-foreground'>
            <Loader2 className='h-5 w-5 animate-spin' />
            <span>Chargement...</span>
          </div>
        )}
        {!hasNextPage && reunions.length > 0 && (
          <p className='text-sm text-muted-foreground'>Toutes les réunions ont été chargées</p>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──
type Tab = 'membres' | 'agenda' | 'historique';

function CommissionDetailContent({
  initialData,
  slug,
}: {
  initialData?: CommissionDetail;
  slug: string;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('membres');
  const router = useRouter();

  const { data: fetchedData, isLoading } = useQuery<{ data: CommissionDetail }>({
    queryKey: ['commission', slug],
    queryFn: () => api.get(`/commissions/${slug}`).then((res) => res.data),
    initialData: initialData ? { data: initialData } : undefined,
    staleTime: 60000,
  });

  const commission = fetchedData?.data ?? initialData;

  if (isLoading && !commission) {
    return (
      <div className='container mx-auto px-4 py-8'>
        <div className='animate-pulse space-y-4'>
          <div className='h-8 w-3/4 rounded bg-muted' />
          <div className='h-4 w-1/2 rounded bg-muted' />
        </div>
      </div>
    );
  }

  if (!commission) {
    return (
      <div className='container mx-auto px-4 py-8'>
        <div className='rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive'>
          Commission introuvable.
        </div>
      </div>
    );
  }

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: 'membres', label: 'Membres', count: commission.nbMembres },
    { id: 'agenda', label: 'Agenda', count: commission.prochainesReunions.length || undefined },
    { id: 'historique', label: 'Historique', count: commission.nbReunions },
  ];

  return (
    <div className='container mx-auto px-4 py-8'>
      {/* Back */}
      <button
        onClick={() => router.back()}
        className='mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
      >
        <ArrowLeft className='h-4 w-4' />
        Retour
      </button>

      {/* Header */}
      <div className='mb-8'>
        <div className='flex items-start gap-4'>
          <div className='rounded-lg border bg-muted/50 p-3 shrink-0'>
            <Building2 className='h-6 w-6 text-primary' />
          </div>
          <div className='flex-1 min-w-0'>
            <h1 className='text-2xl font-bold leading-tight'>{commission.nom}</h1>
            <div className='mt-2 flex flex-wrap items-center gap-2'>
              <span
                className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                  commission.chambre === 'assemblee' ? 'badge-assemblee' : 'badge-senat'
                }`}
              >
                {CHAMBRE_LABELS[commission.chambre] || commission.chambre}
              </span>
              <span className='px-2.5 py-1 rounded-md border text-xs font-medium bg-muted text-muted-foreground'>
                {TYPE_LABELS[commission.type] || commission.type}
              </span>
              {!commission.actif && (
                <span className='px-2.5 py-1 rounded-md border text-xs font-medium bg-muted/50 text-muted-foreground/60'>
                  Inactive
                </span>
              )}
            </div>
            <div className='mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground'>
              <span className='flex items-center gap-1.5'>
                <Users className='h-4 w-4' />
                {commission.nbMembres} membres
              </span>
              <span className='flex items-center gap-1.5'>
                <Calendar className='h-4 w-4' />
                {commission.nbReunions} réunions au total
              </span>
              {commission.dateDebut && (
                <span className='text-xs'>
                  Créée le{' '}
                  {new Date(commission.dateDebut).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className='mb-6 border-b'>
        <div className='flex gap-0 -mb-px'>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {tab.count.toLocaleString('fr-FR')}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'membres' && <TabMembres commission={commission} />}
        {activeTab === 'agenda' && <TabAgenda commission={commission} />}
        {activeTab === 'historique' && <TabHistorique slug={slug} />}
      </div>
    </div>
  );
}

export default function PageClient({
  initialData,
  slug: slugProp,
}: {
  initialData?: CommissionDetail;
  slug?: string;
}) {
  const params = useParams();
  const slug = slugProp ?? (params.slug as string);

  return (
    <Suspense
      fallback={
        <div className='container mx-auto px-4 py-8'>
          <div className='animate-pulse space-y-4'>
            <div className='h-8 w-3/4 rounded bg-muted' />
            <div className='h-4 w-1/2 rounded bg-muted' />
          </div>
        </div>
      }
    >
      <CommissionDetailContent initialData={initialData} slug={slug} />
    </Suspense>
  );
}
