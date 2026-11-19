'use client';

import { useEffect, useState, type ComponentProps } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronDown, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { ExpandableAmendementCard } from '@/components/ExpandableAmendementCard';
import { getAmendementSortClasses, libelleAlinea, normalizeAmendementSort } from '@/lib/amendements';
import { dossierTitreCourtLisible } from '@/lib/dossiers';
import { nettoyerTexteAmendement } from '@/lib/texte-amendement';
import { libelleRole, type RoleAmendement } from '@/components/parlementaire/filtre-role';

type Amendement = ComponentProps<typeof ExpandableAmendementCard>['amendement'];

/** Les familles de sort de l'API (`utils/amendements-sort.ts`). */
type FamilleSort = 'adopte' | 'rejete' | 'non_vote' | 'attente';

const FAMILLES: Array<{ cle: FamilleSort; un: string; plusieurs: string; couleur: string }> = [
  { cle: 'adopte', un: 'adopté', plusieurs: 'adoptés', couleur: 'bg-green-500' },
  { cle: 'rejete', un: 'rejeté', plusieurs: 'rejetés', couleur: 'bg-red-500' },
  { cle: 'non_vote', un: 'non mis aux voix', plusieurs: 'non mis aux voix', couleur: 'bg-slate-400' },
  { cle: 'attente', un: 'en attente', plusieurs: 'en attente', couleur: 'bg-blue-400' },
];

interface GroupeAmendements {
  dossier: { uid: string; titre: string | null; titreCourt: string | null } | null;
  nbAmendements: number;
  sorts: Record<FamilleSort, number>;
  dernierDepot: string | null;
}

interface PageGroupes {
  data: GroupeAmendements[];
  meta: { total: number; totalAmendements: number; totalDossiers: number; page: number; hasNext: boolean };
}

interface PageAmendements {
  data: Amendement[];
  meta: { total: number; page: number; hasNext: boolean };
}

const dateCourte = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Les amendements d'un parlementaire rangés par dossier : un bloc par texte,
 * avec ce qu'il est advenu des amendements, à déplier.
 */
export function AmendementsParDossier({
  base,
  role,
  params,
  onTotal,
}: {
  /** `/deputes/<slug>` ou `/senateurs/<slug>`. */
  base: string;
  /** Amendements déposés ou cosignés. */
  role: RoleAmendement;
  /** Les filtres de l'onglet (période, chambre, votes publics). */
  params: Record<string, unknown>;
  onTotal?: (total: number) => void;
}) {
  const filtres = { ...params, role };
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<PageGroupes>({
    queryKey: ['amendements-par-dossier', base, filtres],
    queryFn: ({ pageParam }) =>
      api.get(`${base}/amendements/dossiers`, { params: { ...filtres, page: pageParam, limit: 20 } }).then((r) => r.data),
    initialPageParam: 1,
    getNextPageParam: (derniere) => (derniere.meta.hasNext ? derniere.meta.page + 1 : undefined),
    staleTime: 5 * 60 * 1000,
  });
  const { loadMoreRef } = useInfiniteScroll({ hasNextPage: !!hasNextPage, isFetchingNextPage, fetchNextPage });

  const meta = data?.pages[0]?.meta;
  const totalAmendements = meta?.totalAmendements;
  useEffect(() => {
    if (totalAmendements !== undefined) onTotal?.(totalAmendements);
  }, [totalAmendements, onTotal]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement des amendements…
      </div>
    );
  }
  const groupes = data?.pages.flatMap((p) => p.data) ?? [];
  if (isError || !meta || groupes.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">Aucun amendement {libelleRole(role, 1)} pour cette période.</p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {meta.totalAmendements.toLocaleString('fr-FR')} amendement{meta.totalAmendements > 1 ? 's' : ''}{' '}
        {libelleRole(role, meta.totalAmendements)} sur{' '}
        {meta.totalDossiers.toLocaleString('fr-FR')} dossier{meta.totalDossiers > 1 ? 's' : ''}
      </p>
      {groupes.map((g) => (
        <BlocDossier key={g.dossier?.uid ?? 'aucun'} groupe={g} base={base} params={filtres} />
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
  groupe: GroupeAmendements;
  base: string;
  params: Record<string, unknown>;
}) {
  const [ouvert, setOuvert] = useState(false);
  const { dossier, nbAmendements: n, sorts, dernierDepot } = groupe;
  const titre = dossier
    ? dossierTitreCourtLisible(dossier.titreCourt) || dossier.titre || dossier.uid
    : 'Sans dossier rattaché';

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
            {n} amendement{n > 1 ? 's' : ''}
            {dernierDepot && <> · dernier dépôt le {dateCourte(dernierDepot)}</>}
          </p>
          <IssueDesAmendements sorts={sorts} total={n} />
        </div>
        <ChevronDown
          className={`mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform ${ouvert ? 'rotate-180' : ''}`}
        />
      </button>

      {ouvert && (
        <div className="border-t">
          {dossier && (
            <Link
              href={`/dossiers/${dossier.uid}`}
              className="group flex items-center gap-1 px-4 pt-3 text-xs text-primary hover:underline"
            >
              Voir le dossier et tous ses amendements
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
          <ListeAmendements base={base} params={params} dossier={dossier?.uid ?? 'aucun'} />
        </div>
      )}
    </section>
  );
}

/** Barre empilée et légende : ce qu'il est advenu des amendements du dossier. */
function IssueDesAmendements({ sorts, total }: { sorts: Record<FamilleSort, number>; total: number }) {
  const presentes = FAMILLES.filter((f) => sorts[f.cle] > 0);
  return (
    <div className="mt-2.5">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        {presentes.map((f) => (
          <div key={f.cle} className={f.couleur} style={{ width: `${(100 * sorts[f.cle]) / total}%` }} />
        ))}
      </div>
      <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {presentes.map((f) => (
          <span key={f.cle} className="inline-flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${f.couleur}`} aria-hidden="true" />
            {sorts[f.cle]} {sorts[f.cle] > 1 ? f.plusieurs : f.un}
          </span>
        ))}
      </p>
    </div>
  );
}

const PAR_PAGE = 20;

/** Les amendements d'un dossier, une ligne chacun, chargés à l'ouverture. */
function ListeAmendements({
  base,
  params,
  dossier,
}: {
  base: string;
  params: Record<string, unknown>;
  dossier: string;
}) {
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<PageAmendements>({
    queryKey: ['amendements-du-dossier', base, params, dossier],
    queryFn: ({ pageParam }) =>
      api
        .get(`${base}/amendements`, { params: { ...params, dossier, page: pageParam, limit: PAR_PAGE } })
        .then((r) => r.data),
    initialPageParam: 1,
    getNextPageParam: (derniere) => (derniere.meta.hasNext ? derniere.meta.page + 1 : undefined),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <p className="px-4 py-3 text-xs text-muted-foreground">Chargement…</p>;
  const amendements = data?.pages.flatMap((p) => p.data) ?? [];
  if (isError || amendements.length === 0) {
    return <p className="px-4 py-3 text-xs text-muted-foreground">Aucun amendement.</p>;
  }
  const reste = (data?.pages[0]?.meta.total ?? 0) - amendements.length;

  return (
    <>
      <ul className="divide-y">
        {amendements.map((a) => (
          <LigneAmendement key={a.id} amendement={a} />
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

/** Une ligne par amendement ; un appui ouvre la carte complète à sa place. */
function LigneAmendement({ amendement: a }: { amendement: Amendement }) {
  const [ouverte, setOuverte] = useState(false);
  const visee = [a.articleVise, libelleAlinea(a)].filter(Boolean).join(', ');
  const apercu = a.dispositif ? nettoyerTexteAmendement(a.dispositif).replace(/\s+/g, ' ').trim() : null;

  if (ouverte) {
    return (
      <li className="space-y-2 p-3">
        <button
          type="button"
          onClick={() => setOuverte(false)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="h-3 w-3 rotate-180" />
          Replier
        </button>
        <ExpandableAmendementCard amendement={a} dossierUid={a.dossier?.uid} />
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setOuverte(true)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm">
            <span className="font-mono font-medium">n&deg;{a.numero}</span>
            {visee && <span className="text-muted-foreground"> · {visee}</span>}
          </span>
          {/* Sans `block` : il écraserait l'affichage dont line-clamp a besoin. */}
          {apercu && <span className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{apercu}</span>}
        </span>
        {/* Le badge, pas le lien de AmendementSortBadge : un lien dans un
            bouton n'est pas cliquable de façon fiable. */}
        {a.sort && (
          <span
            className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${getAmendementSortClasses(a.sort)}`}
          >
            {normalizeAmendementSort(a.sort)}
          </span>
        )}
      </button>
    </li>
  );
}
