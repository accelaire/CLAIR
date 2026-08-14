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
  ChevronDown,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { DOSSIER_ETAT_CONFIG } from '@/lib/dossiers';
import { FilterBar } from '@/components/FilterBar';
import { ScrutinsByDossier } from '@/components/scrutins/ScrutinsByDossier';

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
  nbDossiers: number;
  membres: Array<{
    qualite: string | null;
    parlementaire: {
      id: string;
      slug: string;
      nom: string;
      prenom: string;
      photoUrl: string | null;
      chambre: string;
      groupe: { nom: string; couleur: string | null; slug: string } | null;
    };
  }>;
  anciensMembres?: Array<{
    qualite: string | null;
    dateDebut: string;
    dateFin: string | null;
    parlementaire: {
      id: string;
      slug: string;
      nom: string;
      prenom: string;
      photoUrl: string | null;
      chambre: string;
      groupe: { nom: string; couleur: string | null; slug: string } | null;
    };
  }>;
  prochainesReunions: Array<{
    id: string;
    uid: string;
    dateDebut: string;
    dateFin: string | null;
    lieu: string | null;
    odjResume: string | null;
    odjComplet: string | null;
    etat: string | null;
    captationVideo: boolean | null;
    urlVideo: string | null;
    compteRenduRef: string | null;
  }>;
}

interface ReunionScrutin {
  id: string;
  numero: number;
  titre: string;
  sort: string;
  chambre: string;
  session?: string;
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
  dossier: { id: string; uid: string; titre: string; titreCourt: string | null; procedureLibelle?: string | null } | null;
}

interface Reunion {
  id: string;
  uid: string;
  dateDebut: string;
  dateFin: string | null;
  lieu: string | null;
  odjResume: string | null;
  odjComplet: string | null;
  etat: string | null;
  captationVideo: boolean | null;
  urlVideo: string | null;
  compteRenduRef: string | null;
  nbParticipants?: number;
  scrutins?: ReunionScrutin[];
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
  hemicycle: 'Séance plénière',
  autre: 'Autre',
};

function qualiteOrder(q: string | null): number {
  if (!q) return 99;
  const l = q.toLowerCase();
  if (l.startsWith('président')) return 0;
  if (l.startsWith('vice-président') || l.startsWith('vice président')) return 1;
  if (l.startsWith('secrétaire')) return 2;
  if (l.startsWith('rapporteur')) return 3;
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

function buildCompteRenduUrl(ref: string): string | null {
  if (ref.startsWith('CRCA') || ref.startsWith('CRCO')) {
    return `https://www.assemblee-nationale.fr/dyn/17/comptes-rendus/CRC/${ref}`;
  }
  if (ref.startsWith('CRSA')) {
    return `https://www.assemblee-nationale.fr/dyn/17/comptes-rendus/seance/${ref}`;
  }
  if (ref.startsWith('CRSS') || ref.startsWith('CRSC') || ref.startsWith('CRSI')) {
    return `https://www.senat.fr/compte-rendu-commissions/${ref}.html`;
  }
  return null;
}

/**
 * Ordre du jour d'une réunion.
 *
 * `odjResume` concatène les points de l'ordre du jour avec « | ». Rendu tel
 * quel puis tronqué en CSS, on obtenait une phrase coupée en plein milieu, le
 * séparateur resté pendant : « … du texte de la commission |… ». On sépare donc
 * les points et on les rend individuellement, en annonçant ceux qu'on masque
 * plutôt qu'en les rognant silencieusement.
 */
/** Points affichés avant de replier. Au-delà, la carte devient illisible. */
const ODJ_POINTS_VISIBLES = 3;

function OrdreDuJour({ resume, complet }: { resume: string | null; complet: string | null }) {
  const [deplie, setDeplie] = useState(false);
  // `odjComplet` d'abord : `odjResume` est plafonné à 500 caractères au moment
  // de l'ingestion, si bien que son dernier point est coupé en plein mot — 168
  // réunions sur 311 sont dans ce cas. Le complet sépare les points par des
  // retours à la ligne et va jusqu'à 5 000 caractères.
  const source = complet || resume || '';
  const points = source
    .split(complet ? '\n' : '|')
    .map((p) => p.trim())
    .filter(Boolean);

  if (points.length === 0) return null;

  // Les points sont affichés en entier, sans troncature CSS : l'ordre du jour
  // est ce que la commission a réellement traité, le rogner vide la ligne de
  // son sens. Au-delà de trois points on replie — 65 % des réunions en ont
  // plus de deux, en masquer une partie sans recours serait de la perte sèche.
  const visibles = deplie ? points : points.slice(0, ODJ_POINTS_VISIBLES);
  const restants = points.length - visibles.length;

  return (
    <div className='text-sm text-muted-foreground space-y-1'>
      {visibles.map((point, i) => (
        <p key={i} className='flex gap-1.5'>
          {points.length > 1 && <span className='opacity-60 shrink-0'>•</span>}
          <span className='min-w-0'>{point}</span>
        </p>
      ))}
      {restants > 0 && (
        <button
          type='button'
          onClick={() => setDeplie(true)}
          className='text-xs underline underline-offset-2 hover:text-foreground transition-colors'
        >
          + {restants} autre{restants > 1 ? 's' : ''} point{restants > 1 ? 's' : ''} à l&apos;ordre du jour
        </button>
      )}
      {deplie && points.length > ODJ_POINTS_VISIBLES && (
        <button
          type='button'
          onClick={() => setDeplie(false)}
          className='text-xs underline underline-offset-2 hover:text-foreground transition-colors'
        >
          Réduire
        </button>
      )}
    </div>
  );
}

function ReunionItem({ reunion }: { reunion: Reunion }) {
  const isPast = new Date(reunion.dateDebut) < new Date();
  const crUrl = isPast && reunion.compteRenduRef ? buildCompteRenduUrl(reunion.compteRenduRef) : null;
  const hasScrutins = reunion.scrutins && reunion.scrutins.length > 0;

  return (
    <div className='rounded-lg border bg-card p-4'>
      <div className='flex items-start justify-between gap-3'>
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-x-2 gap-y-0.5 flex-wrap text-sm font-medium mb-1'>
            <span className='flex items-center gap-1.5'>
              <Clock className='h-3.5 w-3.5 text-muted-foreground shrink-0' />
              <span className='capitalize'>{formatDate(reunion.dateDebut)}</span>
            </span>
            <span className='whitespace-nowrap text-muted-foreground'>
              · {formatTime(reunion.dateDebut)}
              {reunion.dateFin && ` — ${formatTime(reunion.dateFin)}`}
            </span>
          </div>
          {(reunion.odjComplet || reunion.odjResume) && (
            <OrdreDuJour resume={reunion.odjResume} complet={reunion.odjComplet} />
          )}
          {reunion.lieu && (
            <p className='mt-1 flex items-center gap-1 text-xs text-muted-foreground'>
              <MapPin className='h-3 w-3' />
              {reunion.lieu}
            </p>
          )}
        </div>
        <div className='flex flex-col items-end gap-1 shrink-0'>
          {reunion.urlVideo && (
            <a
              href={reunion.urlVideo}
              target='_blank'
              rel='noopener noreferrer'
              className='flex items-center gap-1 px-2 py-0.5 rounded text-xs border bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 transition-colors dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800 dark:hover:bg-violet-950/50'
            >
              <Video className='h-3 w-3' />
              Vidéo
            </a>
          )}
          {crUrl && (
            <a
              href={crUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='flex items-center gap-1 px-2 py-0.5 rounded text-xs border bg-muted/50 text-muted-foreground border-border hover:text-foreground hover:border-foreground transition-colors'
            >
              Compte rendu
            </a>
          )}
          {reunion.nbParticipants !== undefined && reunion.nbParticipants > 0 && (
            <span className='text-xs text-muted-foreground'>
              {reunion.nbParticipants} participants
            </span>
          )}
        </div>
      </div>

      {hasScrutins && (
        <div className='mt-3 pt-3 border-t'>
          <ScrutinsByDossier
            scrutins={reunion.scrutins!}
            label='Scrutins de la séance'
          />
        </div>
      )}
    </div>
  );
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function MembreRow({
  qualite,
  parlementaire,
  dateDebut,
  dateFin,
}: {
  qualite: string | null;
  parlementaire: CommissionDetail['membres'][0]['parlementaire'];
  dateDebut?: string;
  dateFin?: string | null;
}) {
  const isDeputy = parlementaire.chambre === 'assemblee' || parlementaire.chambre === 'depute';
  const href = isDeputy ? `/deputes/${parlementaire.slug}` : `/senateurs/${parlementaire.slug}`;
  const isPast = dateFin != null;

  return (
    <Link
      href={href}
      className={`group flex items-center gap-4 rounded-lg border bg-card p-3 transition-all hover:border-primary hover:shadow-sm ${isPast ? 'opacity-70' : ''}`}
    >
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
        {isPast && dateDebut && (
          <p className='mt-0.5 text-xs text-muted-foreground/70'>
            {formatShortDate(dateDebut)}
            {dateFin ? ` → ${formatShortDate(dateFin)}` : ''}
          </p>
        )}
      </div>
      <ChevronRight className='h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0' />
    </Link>
  );
}

// ── Tab Membres ──
function TabMembres({ commission }: { commission: CommissionDetail }) {
  const [showAnciens, setShowAnciens] = useState(false);

  const sorted = [...commission.membres].sort(
    (a, b) => qualiteOrder(a.qualite) - qualiteOrder(b.qualite),
  );
  const anciens = commission.anciensMembres ?? [];

  if (sorted.length === 0 && anciens.length === 0) {
    return (
      <div className='py-12 text-center text-muted-foreground'>
        Aucun membre enregistré pour cette commission.
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Membres actuels */}
      {sorted.length > 0 ? (
        <div className='space-y-2'>
          {sorted.map(({ qualite, parlementaire }) => (
            <MembreRow key={parlementaire.id} qualite={qualite} parlementaire={parlementaire} />
          ))}
        </div>
      ) : (
        <div className='py-8 text-center text-muted-foreground text-sm'>
          Aucun membre actuel enregistré.
        </div>
      )}

      {/* Anciens membres — repliable */}
      {anciens.length > 0 && (
        <div>
          <button
            onClick={() => setShowAnciens((v) => !v)}
            className='flex w-full items-center justify-between rounded-lg border bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors'
          >
            <span>Anciens membres ({anciens.length})</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showAnciens ? 'rotate-180' : ''}`}
            />
          </button>
          {showAnciens && (
            <div className='mt-2 space-y-2'>
              {anciens.map((m, i) => (
                <MembreRow
                  key={`${m.parlementaire.id}-${m.dateDebut}-${i}`}
                  qualite={m.qualite}
                  parlementaire={m.parlementaire}
                  dateDebut={m.dateDebut}
                  dateFin={m.dateFin}
                />
              ))}
            </div>
          )}
        </div>
      )}
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

// ── Tab Textes & Rapports ──
interface DossierItem {
  uid: string;
  titre: string;
  titreCourt: string | null;
  etat: string | null;
  dateDepot: string | null;
  urlAN: string | null;
  urlSenat: string | null;
  procedureLibelle: string | null;
  role: 'fond' | 'avis';
}

interface DossiersResponse {
  data: DossierItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const ROLE_CONFIG: Record<string, { label: string; className: string }> = {
  fond: {
    label: 'Saisie au fond',
    className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  },
  avis: {
    label: 'Saisie pour avis',
    className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  },
};

const formatDossierTitre = (titre: string, procedureLibelle?: string | null): string => {
  const firstChar = titre.charAt(0);
  if (firstChar !== firstChar.toUpperCase() && procedureLibelle) {
    return `${procedureLibelle} ${titre}`;
  }
  return titre;
};

function TabDossiers({ slug }: { slug: string }) {
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [etatFilter, setEtatFilter] = useState<string>('');

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<DossiersResponse>({
    queryKey: ['commission-dossiers', slug, roleFilter, etatFilter],
    queryFn: ({ pageParam = 1 }) => {
      const params: Record<string, unknown> = { page: pageParam, limit: 20 };
      if (roleFilter) params.role = roleFilter;
      if (etatFilter) params.etat = etatFilter;
      return api
        .get(`/commissions/${slug}/dossiers`, { params })
        .then((res) => res.data);
    },
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

  const dossiers = data?.pages.flatMap((p) => p.data) ?? [];
  const total = data?.pages[0]?.pagination.total ?? 0;

  const activeFilterCount = (roleFilter ? 1 : 0) + (etatFilter ? 1 : 0);

  return (
    <div>
      <FilterBar
        search={
          <span className='text-sm text-muted-foreground whitespace-nowrap py-2'>
            {total > 0 ? `${total.toLocaleString('fr-FR')} dossier${total > 1 ? 's' : ''}` : ''}
          </span>
        }
        activeFilterCount={activeFilterCount}
        onClear={() => { setRoleFilter(''); setEtatFilter(''); }}
      >
        <div className='relative md:w-auto'>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className='w-full appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary'
          >
            <option value=''>Tous les rôles</option>
            <option value='fond'>Saisie au fond</option>
            <option value='avis'>Saisie pour avis</option>
          </select>
          <ChevronDown className='absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none' />
        </div>
        <div className='relative md:w-auto'>
          <select
            value={etatFilter}
            onChange={(e) => setEtatFilter(e.target.value)}
            className='w-full appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary'
          >
            <option value=''>Tous les états</option>
            {Object.entries(DOSSIER_ETAT_CONFIG).map(([value, cfg]) => (
              <option key={value} value={value}>{cfg.label}</option>
            ))}
          </select>
          <ChevronDown className='absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none' />
        </div>
      </FilterBar>

      {isLoading ? (
        <div className='space-y-4'>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className='animate-pulse rounded-lg border bg-card p-4'>
              <div className='h-5 w-3/4 rounded bg-muted mb-2' />
              <div className='h-4 w-1/2 rounded bg-muted' />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className='rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive'>
          Erreur lors du chargement des dossiers.
        </div>
      ) : dossiers.length === 0 ? (
        <div className='py-12 text-center text-muted-foreground'>
          Aucun dossier enregistré pour cette commission.
        </div>
      ) : (
        <>
          <div className='space-y-4'>
            {dossiers.map((dossier) => {
              const etatCfg = dossier.etat ? DOSSIER_ETAT_CONFIG[dossier.etat] : null;
              const roleCfg = ROLE_CONFIG[dossier.role];
              return (
                <Link
                  key={`${dossier.uid}-${dossier.role}`}
                  href={`/dossiers/${dossier.uid}`}
                  className='block rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md'
                >
                  <div className='flex items-start justify-between gap-3'>
                    <div className='flex-1 min-w-0'>
                      {/* Badges */}
                      <div className='flex items-center gap-2 mb-1 flex-wrap'>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${roleCfg.className}`}
                          title={dossier.role === 'fond'
                            ? 'Commission principale qui examine le texte'
                            : 'Commission qui donne un avis consultatif'}
                        >
                          {roleCfg.label}
                        </span>
                        {etatCfg && (
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${etatCfg.color}`}>
                            {etatCfg.label}
                          </span>
                        )}
                        {dossier.procedureLibelle && (
                          <span className='px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded'>
                            {dossier.procedureLibelle}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className='font-semibold leading-tight mb-1 line-clamp-2'>
                        {formatDossierTitre(dossier.titre, dossier.procedureLibelle)}
                      </h3>
                      {dossier.titreCourt && dossier.titreCourt !== dossier.titre && (
                        <p className='text-sm text-muted-foreground mb-2 line-clamp-1'>{dossier.titreCourt}</p>
                      )}

                      {/* Meta */}
                      {dossier.dateDepot && (
                        <p className='text-sm text-muted-foreground'>
                          Déposé le{' '}
                          {new Date(dossier.dateDepot).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      )}
                    </div>

                    <ArrowRight className='h-5 w-5 text-muted-foreground shrink-0 mt-1 hidden sm:block' />
                  </div>
                </Link>
              );
            })}
          </div>
          <div ref={loadMoreRef} className='mt-8 flex justify-center py-4'>
            {isFetchingNextPage && (
              <div className='flex items-center gap-2 text-muted-foreground'>
                <Loader2 className='h-5 w-5 animate-spin' />
                <span>Chargement...</span>
              </div>
            )}
            {!hasNextPage && dossiers.length > 0 && (
              <p className='text-sm text-muted-foreground'>Tous les dossiers ont été chargés</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Component ──
type Tab = 'membres' | 'agenda' | 'historique' | 'dossiers';

function CommissionDetailContent({
  initialData,
  slug,
}: {
  initialData?: CommissionDetail;
  slug: string;
}) {
  const commission_type_init = initialData?.type;
  const defaultTab: Tab = commission_type_init === 'hemicycle' ? 'historique' : 'membres';
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
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

  const isHemicycle = commission.type === 'hemicycle';

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    ...(!isHemicycle ? [{ id: 'membres' as Tab, label: 'Membres', count: commission.nbMembres }] : []),
    { id: 'agenda', label: isHemicycle ? 'Prochaines séances' : 'Agenda', count: commission.prochainesReunions.length || undefined },
    { id: 'historique', label: isHemicycle ? 'Séances passées' : 'Historique', count: commission.nbReunions },
    ...(!isHemicycle && commission.nbDossiers > 0 ? [{ id: 'dossiers' as Tab, label: 'Textes & Rapports', count: commission.nbDossiers }] : []),
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
            <h1 className='text-xl sm:text-2xl font-bold leading-tight break-words'>{commission.nom}</h1>
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
              {!isHemicycle && (
                <span className='flex items-center gap-1.5'>
                  <Users className='h-4 w-4' />
                  {commission.nbMembres} membres
                </span>
              )}
              <span className='flex items-center gap-1.5'>
                <Calendar className='h-4 w-4' />
                {commission.nbReunions} {isHemicycle ? 'séances' : 'réunions'} au total
              </span>
              {!isHemicycle && commission.nbDossiers > 0 && (
                <span className='flex items-center gap-1.5'>
                  <FileText className='h-4 w-4' />
                  {commission.nbDossiers} texte{commission.nbDossiers > 1 ? 's' : ''} examiné{commission.nbDossiers > 1 ? 's' : ''}
                </span>
              )}
              {commission.dateDebut && (
                <span className='text-xs'>
                  Depuis le{' '}
                  {new Date(commission.dateDebut).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              )}
            </div>
            {(() => {
              const president = commission.membres.find((m) =>
                m.qualite?.toLowerCase().startsWith('président'),
              );
              if (!president) return null;
              const isDeputy = president.parlementaire.chambre === 'assemblee' || president.parlementaire.chambre === 'depute';
              const href = isDeputy
                ? `/deputes/${president.parlementaire.slug}`
                : `/senateurs/${president.parlementaire.slug}`;
              return (
                <div className='mt-3 flex items-center gap-2'>
                  <span className='text-xs text-muted-foreground'>Présidé par</span>
                  <Link
                    href={href}
                    className='inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline'
                  >
                    {president.parlementaire.prenom} {president.parlementaire.nom}
                  </Link>
                  <span className='text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700'>
                    {president.qualite}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className='mb-6 border-b overflow-x-auto scrollbar-none'>
        <div className='flex gap-0 -mb-px min-w-max'>
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
        {activeTab === 'membres' && !isHemicycle && <TabMembres commission={commission} />}
        {activeTab === 'agenda' && <TabAgenda commission={commission} />}
        {activeTab === 'historique' && <TabHistorique slug={slug} />}
        {activeTab === 'dossiers' && <TabDossiers slug={slug} />}
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
