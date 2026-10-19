'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ChevronDown, CornerDownRight } from 'lucide-react';
import { api } from '@/lib/api';
import { AmendementSortBadge } from '@/components/AmendementSortBadge';
import {
  amendementHref,
  libelleAlinea,
  libellePositionDiscussion,
  type MetadonneesAmendement,
} from '@/lib/amendements';
import { scrutinHref } from '@/lib/scrutin-url';

// Le premier nom d'une liste de signataires (« Mme A, M. B et M. C »).
const premierAuteur = (libelle: string | null) => libelle?.split(/,\s*|\s+et\s+/u)[0]?.trim() || null;

// « de M. X », mais « du Gouvernement » : l'auteur est publié « le Gouvernement »
// à l'Assemblée et « LE GOUVERNEMENT » au Sénat.
const deLAuteur = (auteur: string) =>
  /^le gouvernement$/iu.test(auteur) ? 'du Gouvernement' : `de ${auteur}`;

/**
 * Lien vers un amendement, dans la page de son dossier.
 *
 * Déjà sur cette page, le lien ne fait que changer l'amendement visé : la page
 * reste où elle est et défile jusqu'à lui (cf. la page du dossier).
 */
function LienAmendement({
  dossierUid,
  uid,
  className,
  children,
}: {
  dossierUid: string;
  uid: string;
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const surLaPage = pathname === `/dossiers/${encodeURIComponent(dossierUid)}`;
  return (
    <Link href={amendementHref(dossierUid, uid)} scroll={!surLaPage} className={className}>
      {children}
    </Link>
  );
}

/** « Sous-amendement à l'amendement n° 662 de M. X », qui mène à l'amendement. */
export function SousAmendementDe({
  amendement,
  dossierUid,
  className = 'mb-2',
}: {
  amendement: MetadonneesAmendement;
  /** Le dossier de l'amendement : sans lui, la mention reste du texte. */
  dossierUid?: string | null;
  className?: string;
}) {
  const parent = amendement.amendementParent;
  if (!parent) return null;
  const auteur = premierAuteur(parent.auteurLibelle);
  const libelle = (
    <>
      l&apos;amendement n&deg;{parent.numero}
      {auteur && <> {deLAuteur(auteur)}</>}
    </>
  );
  return (
    <p className={`flex items-center gap-1.5 text-sm text-muted-foreground ${className}`}>
      <CornerDownRight className="h-3.5 w-3.5 flex-shrink-0" />
      <span>
        Sous-amendement à{' '}
        {dossierUid ? (
          <LienAmendement dossierUid={dossierUid} uid={parent.uid} className="text-primary hover:underline">
            {libelle}
          </LienAmendement>
        ) : (
          libelle
        )}
      </span>
    </p>
  );
}

type Liste = 'sous' | 'commune' | 'identique';

interface AmendementLie {
  id: string;
  uid: string;
  numero: string;
  auteurLibelle: string | null;
  sort: string | null;
  articleVise: string | null;
  alinea: string | null;
  alineaNumero: number | null;
  scrutins?: Array<{ id: string; numero: number | string; chambre: string; session: string | null }>;
}

/**
 * Les sous-amendements d'un amendement, et les amendements discutés avec lui
 * (discussion commune) ou identiques au sien, dépliables.
 *
 * Les listes se chargent à l'ouverture, depuis le dossier de l'amendement : un
 * identifiant de discussion n'existe qu'au sein d'un dossier et d'une chambre.
 * Sans dossier connu, les badges restent informatifs.
 */
export function DiscussionsEtSousAmendements({
  amendement,
  dossierUid,
  enTete,
}: {
  amendement: MetadonneesAmendement & { id: string };
  dossierUid?: string | null;
  /**
   * Placé en tête de la ligne des badges, qui passent à la ligne quand la
   * largeur manque : la mention « Sous-amendement à… » sur la page d'un vote.
   */
  enTete?: React.ReactNode;
}) {
  const [ouverte, setOuverte] = useState<Liste | null>(null);

  const nbSous = amendement.sousAmendementsCount ?? 0;
  const boutons: Array<{ cle: Liste; libelle: string; titre?: string }> = [];
  if (nbSous > 0) {
    boutons.push({ cle: 'sous', libelle: `${nbSous} sous-amendement${nbSous > 1 ? 's' : ''}` });
  }
  if (amendement.idDiscussionCommune) {
    const position = libellePositionDiscussion(amendement.positionDiscussionCommune);
    boutons.push({
      cle: 'commune',
      libelle: 'Discussion commune',
      titre: `Discuté en séance avec d'autres amendements portant sur le même passage${position ? `, ${position}` : ''}.`,
    });
  }
  if (amendement.idDiscussionIdentique) {
    boutons.push({
      cle: 'identique',
      libelle: 'Amendements identiques',
      titre: 'D\'autres amendements proposent la même rédaction : ils sont mis aux voix ensemble.',
    });
  }
  if (boutons.length === 0) return enTete ? <div className="mt-3">{enTete}</div> : null;

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        {enTete}
        {boutons.map((b) =>
          dossierUid ? (
            <button
              key={b.cle}
              type="button"
              title={b.titre}
              aria-expanded={ouverte === b.cle}
              onClick={() => setOuverte(ouverte === b.cle ? null : b.cle)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                ouverte === b.cle
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
              }`}
            >
              {b.libelle}
              <ChevronDown className={`h-3 w-3 transition-transform ${ouverte === b.cle ? 'rotate-180' : ''}`} />
            </button>
          ) : (
            <span
              key={b.cle}
              title={b.titre}
              className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
            >
              {b.libelle}
            </span>
          ),
        )}
      </div>
      {ouverte && dossierUid && (
        <AmendementsLies dossierUid={dossierUid} liste={ouverte} amendement={amendement} />
      )}
    </div>
  );
}

const LIMITE = 100;

interface PageAmendementsLies {
  data: AmendementLie[];
  meta: { total: number; page: number; hasNext: boolean };
}

/**
 * La liste dépliée : chaque amendement mène à sa carte dans le dossier, et à
 * son vote quand il a été mis aux voix par un scrutin public.
 */
function AmendementsLies({
  dossierUid,
  liste,
  amendement,
}: {
  dossierUid: string;
  liste: Liste;
  amendement: MetadonneesAmendement & { id: string };
}) {
  const params =
    liste === 'sous'
      ? { parentId: amendement.id }
      : liste === 'commune'
        ? { discussionCommune: amendement.idDiscussionCommune, chambre: amendement.chambre }
        : { discussionIdentique: amendement.idDiscussionIdentique, chambre: amendement.chambre };

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery<PageAmendementsLies>({
      queryKey: ['amendements-lies', dossierUid, params],
      queryFn: ({ pageParam }) =>
        api.get(`/dossiers/${encodeURIComponent(dossierUid)}/amendements`, {
          params: { ...params, limit: LIMITE, page: pageParam },
        }).then((r) => r.data),
      initialPageParam: 1,
      getNextPageParam: (derniere) => (derniere.meta.hasNext ? derniere.meta.page + 1 : undefined),
      staleTime: 5 * 60 * 1000,
    });

  if (isLoading) return <p className="mt-2 text-xs text-muted-foreground">Chargement…</p>;
  const amendements = data?.pages.flatMap((p) => p.data) ?? [];
  if (isError || amendements.length === 0) {
    return <p className="mt-2 text-xs text-muted-foreground">Liste indisponible.</p>;
  }

  const reste = (data?.pages[0]?.meta.total ?? 0) - amendements.length;
  return (
    <ul className="mt-2 divide-y divide-border rounded-lg border bg-muted/30">
      {amendements.map((a) => {
        const alinea = libelleAlinea(a);
        const lui = a.id === amendement.id;
        const description = (
          <>
            <span className="font-mono font-medium group-hover:text-primary group-hover:underline">n&deg;{a.numero}</span>
            {lui && <span className="ml-1.5 text-xs text-muted-foreground">(celui-ci)</span>}
            {(a.articleVise || alinea) && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                {[a.articleVise, alinea].filter(Boolean).join(', ')}
              </span>
            )}
            {premierAuteur(a.auteurLibelle) && (
              <span className="block text-xs text-muted-foreground line-clamp-1">{premierAuteur(a.auteurLibelle)}</span>
            )}
          </>
        );
        return (
          <li key={a.id} className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${lui ? 'bg-primary/5' : ''}`}>
            {lui ? (
              <div className="min-w-0">{description}</div>
            ) : (
              <LienAmendement
                dossierUid={dossierUid}
                uid={a.uid}
                className="group min-w-0"
              >
                {description}
              </LienAmendement>
            )}
            <div className="flex flex-shrink-0 items-center gap-2">
              {a.scrutins?.map((s) => (
                <Link key={s.id} href={scrutinHref(s)} className="text-xs text-primary hover:underline">
                  vote n&deg;{s.numero}
                </Link>
              ))}
              <AmendementSortBadge sort={a.sort} />
            </div>
          </li>
        );
      })}
      {reste > 0 && (
        <li className="px-3 py-2">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={!hasNextPage || isFetchingNextPage}
            className="text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
          >
            {isFetchingNextPage
              ? 'Chargement…'
              : `Afficher les ${Math.min(reste, LIMITE)} suivants (${reste} restant${reste > 1 ? 's' : ''})`}
          </button>
        </li>
      )}
    </ul>
  );
}
