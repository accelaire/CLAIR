'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CheckCircle, ChevronDown, Loader2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { STALE_TIME_LISTE_MS } from '@/lib/liste-ssr';
import { dossierTitreCourtLisible } from '@/lib/dossiers';
import { scrutinHref } from '@/lib/scrutin-url';
import { titreDansLeDossier } from '@/lib/titre-scrutin-dossier';
import { POSITIONS_VOTE, VotePositionBadge } from '@/components/parlementaire/vote-position-badge';

type Position = 'pour' | 'contre' | 'abstention' | 'absent';
type Nature = 'ensemble' | 'article' | 'amendement' | 'motion';

interface ScrutinResume {
  id: string;
  numero: number;
  chambre: string;
  session: string | null;
  date: string;
  titre: string;
  sort: string;
}

interface GroupeVotes {
  dossier: { uid: string; titre: string | null; titreCourt: string | null } | null;
  nbVotes: number;
  positions: Record<Position, number>;
  dissidents: number;
  parNature: Record<Nature | 'autre', number>;
  dernierVote: string;
  ensemble: Array<{ position: string; groupePosition: string | null; scrutin: ScrutinResume }>;
}

interface PageGroupes {
  data: GroupeVotes[];
  meta: { total: number; totalVotes: number; totalDossiers: number; page: number; hasNext: boolean };
}

/** Une page de `/:slug/votes/dossiers`, telle que la fiche la reçoit du serveur. */
export type PageGroupesVotes = PageGroupes;

interface VoteLigne {
  id: string;
  position: string;
  groupePosition: string | null;
  scrutin: ScrutinResume & { nature: string | null };
}

interface PageVotes {
  data: VoteLigne[];
  meta: { total: number; page: number; hasNext: boolean };
}

const NATURES: Array<{ cle: Nature; libelle: string }> = [
  { cle: 'ensemble', libelle: 'Ensemble du texte' },
  { cle: 'article', libelle: 'Articles' },
  { cle: 'amendement', libelle: 'Amendements' },
  { cle: 'motion', libelle: 'Motions' },
];

const ORDRE_POSITIONS: Position[] = ['pour', 'contre', 'abstention', 'absent'];
const dateCourte = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/** Un vote exprimé contraire à la majorité (connue) de son groupe. */
const estDissident = (position: string, groupePosition: string | null) =>
  !!groupePosition && position !== 'absent' && position !== groupePosition;

/**
 * Les votes d'un parlementaire rangés par dossier : un bloc par texte, avec son
 * vote sur l'ensemble et la répartition de ses votes, à déplier.
 */
export function VotesParDossier({
  base,
  params,
  onTotal,
  initial,
}: {
  /** `/deputes/<slug>` ou `/senateurs/<slug>`. */
  base: string;
  /** Les filtres de l'onglet (période, chambre, votes dissidents). */
  params: Record<string, unknown>;
  onTotal?: (total: number) => void;
  /** Première page rendue par le serveur ; seulement quand aucun filtre n'est actif. */
  initial?: PageGroupes;
}) {
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<PageGroupes>({
    queryKey: ['votes-par-dossier', base, params],
    queryFn: ({ pageParam }) =>
      api.get(`${base}/votes/dossiers`, { params: { ...params, page: pageParam, limit: 20 } }).then((r) => r.data),
    initialPageParam: 1,
    getNextPageParam: (derniere) => (derniere.meta.hasNext ? derniere.meta.page + 1 : undefined),
    staleTime: initial ? STALE_TIME_LISTE_MS : 5 * 60 * 1000,
    ...(initial && { initialData: { pages: [initial], pageParams: [1] } }),
  });
  const { loadMoreRef } = useInfiniteScroll({ hasNextPage: !!hasNextPage, isFetchingNextPage, fetchNextPage });

  const meta = data?.pages[0]?.meta;
  const totalVotes = meta?.totalVotes;
  useEffect(() => {
    if (totalVotes !== undefined) onTotal?.(totalVotes);
  }, [totalVotes, onTotal]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement des votes…
      </div>
    );
  }
  const groupes = data?.pages.flatMap((p) => p.data) ?? [];
  if (isError || !meta || groupes.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">Aucun vote trouvé pour cette période.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {meta.totalVotes.toLocaleString('fr-FR')} vote{meta.totalVotes > 1 ? 's' : ''} sur{' '}
        {meta.totalDossiers.toLocaleString('fr-FR')} dossier{meta.totalDossiers > 1 ? 's' : ''}
        {meta.total > meta.totalDossiers && <>, et des votes hors dossier</>}
      </p>
      {groupes.map((g) => (
        <BlocDossier key={g.dossier?.uid ?? 'aucun'} groupe={g} base={base} params={params} />
      ))}
      <div ref={loadMoreRef} className="h-4" />
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function BlocDossier({
  groupe,
  base,
  params,
}: {
  groupe: GroupeVotes;
  base: string;
  params: Record<string, unknown>;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [nature, setNature] = useState<Nature | null>(null);
  const { dossier, nbVotes, positions, dissidents, parNature, dernierVote, ensemble } = groupe;
  const titre = dossier
    ? dossierTitreCourtLisible(dossier.titreCourt) || dossier.titre || dossier.uid
    : 'Autres votes : motions de censure, procédure…';
  const final = ensemble[0];

  return (
    <section className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        aria-expanded={ouvert}
        className="flex w-full items-start justify-between gap-3 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <h3 className={`font-medium leading-snug line-clamp-2 ${dossier ? '' : 'text-muted-foreground'}`}>{titre}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {nbVotes} vote{nbVotes > 1 ? 's' : ''} · dernier le {dateCourte(dernierVote)}
          </p>
          <Repartition positions={positions} total={nbVotes} dissidents={dissidents} />
        </div>
        <ChevronDown
          className={`mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform ${ouvert ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Hors du bouton : le lien vers le scrutin doit rester un lien. */}
      {final && (
        <div className="-mt-1 px-4 pb-4">
          <Link
            href={scrutinHref(final.scrutin)}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm hover:bg-primary/10"
          >
            <span className="font-medium">Sur l&apos;ensemble du texte</span>
            <VotePositionBadge position={final.position} />
            <span className="text-xs text-muted-foreground">
              texte {final.scrutin.sort === 'adopte' ? 'adopté' : 'rejeté'} le {dateCourte(final.scrutin.date)}
              {ensemble.length > 1 && <> · dernière de {ensemble.length} lectures</>}
            </span>
            {estDissident(final.position, final.groupePosition) && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600">
                <AlertTriangle className="h-3 w-3" />
                contre la majorité de son groupe
              </span>
            )}
          </Link>
        </div>
      )}

      {ouvert && (
        <div className="border-t">
          <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
            <Puce actif={nature === null} onClick={() => setNature(null)}>
              Tous {nbVotes}
            </Puce>
            {NATURES.filter((n) => parNature[n.cle] > 0).map((n) => (
              <Puce key={n.cle} actif={nature === n.cle} onClick={() => setNature(n.cle)}>
                {n.libelle} {parNature[n.cle]}
              </Puce>
            ))}
          </div>
          {dossier && (
            <Link
              href={`/dossiers/${dossier.uid}`}
              className="group flex items-center gap-1 px-4 pt-3 text-xs text-primary hover:underline"
            >
              Voir le dossier
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
          <ListeVotes base={base} params={params} dossier={dossier?.uid ?? 'aucun'} nature={nature} />
        </div>
      )}
    </section>
  );
}

function Puce({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
        actif ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  );
}

/** Barre empilée et légende des positions, plus les votes contre son groupe. */
function Repartition({
  positions,
  total,
  dissidents,
}: {
  positions: Record<Position, number>;
  total: number;
  dissidents: number;
}) {
  const presentes = ORDRE_POSITIONS.filter((p) => positions[p] > 0);
  return (
    <div className="mt-2.5">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        {presentes.map((p) => (
          <div key={p} className={POSITIONS_VOTE[p]!.barre} style={{ width: `${(100 * positions[p]) / total}%` }} />
        ))}
      </div>
      {/* La légende des cartes de /scrutins (✓ pour, ✗ contre, « abs. ») : assez
          courte pour garder les dissidents sur la même ligne d'un téléphone. */}
      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {positions.pour > 0 && (
          <span className="flex items-center gap-1 text-adopte" title="Pour">
            <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {positions.pour}
            <span className="sr-only"> pour</span>
          </span>
        )}
        {positions.contre > 0 && (
          <span className="flex items-center gap-1 text-rejete" title="Contre">
            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {positions.contre}
            <span className="sr-only"> contre</span>
          </span>
        )}
        {positions.abstention > 0 && (
          <span className="text-muted-foreground" title="Abstentions">
            {positions.abstention} abs.
          </span>
        )}
        {positions.absent > 0 && (
          <span className="text-muted-foreground">
            {positions.absent} absence{positions.absent > 1 ? 's' : ''}
          </span>
        )}
        {dissidents > 0 && (
          <span
            className="flex items-center gap-1 font-medium text-orange-600"
            title="Votes contraires à la majorité de son groupe"
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            {dissidents} dissident{dissidents > 1 ? 's' : ''}
          </span>
        )}
      </p>
    </div>
  );
}

const PAR_PAGE = 30;

/** Les votes d'un dossier, une ligne chacun, chargés à l'ouverture. */
function ListeVotes({
  base,
  params,
  dossier,
  nature,
}: {
  base: string;
  params: Record<string, unknown>;
  dossier: string;
  nature: Nature | null;
}) {
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<PageVotes>({
    queryKey: ['votes-du-dossier', base, params, dossier, nature],
    queryFn: ({ pageParam }) =>
      api
        .get(`${base}/votes`, {
          params: { ...params, dossier, ...(nature && { nature }), page: pageParam, limit: PAR_PAGE },
        })
        .then((r) => r.data),
    initialPageParam: 1,
    getNextPageParam: (derniere) => (derniere.meta.hasNext ? derniere.meta.page + 1 : undefined),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <p className="px-4 py-3 text-xs text-muted-foreground">Chargement…</p>;
  const votes = data?.pages.flatMap((p) => p.data) ?? [];
  if (isError || votes.length === 0) return <p className="px-4 py-3 text-xs text-muted-foreground">Aucun vote.</p>;
  const reste = (data?.pages[0]?.meta.total ?? 0) - votes.length;

  return (
    <>
      <ul className="mt-2 divide-y">
        {votes.map((v) => (
          <li key={v.id}>
            <Link
              href={scrutinHref(v.scrutin)}
              className={`flex items-start justify-between gap-3 px-4 py-3 hover:bg-muted/40 ${
                estDissident(v.position, v.groupePosition) ? 'bg-orange-50/60 dark:bg-orange-950/20' : ''
              }`}
            >
              <span className="min-w-0 flex-1">
                {/* Sans `block` : il écraserait l'affichage dont line-clamp a besoin. */}
                <span className="text-sm leading-snug line-clamp-2" title={v.scrutin.titre}>
                  {titreDansLeDossier(v.scrutin.titre)}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {dateCourte(v.scrutin.date)} ·{' '}
                  <span className={v.scrutin.sort === 'adopte' ? 'text-adopte' : 'text-rejete'}>
                    {v.scrutin.sort === 'adopte' ? 'Adopté' : 'Rejeté'}
                  </span>
                  {estDissident(v.position, v.groupePosition) && (
                    <span className="font-medium text-orange-600"> · contre son groupe</span>
                  )}
                </span>
              </span>
              <span className="flex-shrink-0">
                <VotePositionBadge position={v.position} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {reste > 0 && (
        <button
          type="button"
          onClick={() => fetchNextPage()}
          disabled={!hasNextPage || isFetchingNextPage}
          className="w-full border-t px-4 py-3 text-left text-xs font-medium text-primary hover:underline disabled:text-muted-foreground"
        >
          {isFetchingNextPage ? 'Chargement…' : `Afficher les ${Math.min(reste, PAR_PAGE)} suivants (${reste} restants)`}
        </button>
      )}
    </>
  );
}
