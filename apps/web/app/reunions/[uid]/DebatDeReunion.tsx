'use client';

// =============================================================================
// Le débat d'une réunion, déroulé comme il s'est tenu
// =============================================================================
//
// POURQUOI IL SE CHARGE PAR PAGES. Une séance publique porte 355 prises de
// parole en moyenne et jusqu'à 1 614, soit plus d'un mégaoctet de texte. La
// servir d'un bloc ferait une page qu'aucun lecteur n'attend. Le défilement
// continu garde pourtant la lecture d'un seul tenant, ce qu'une pagination
// numérotée casserait.
//
// POURQUOI LES VOTES SONT DANS LE FIL. Chaque prise de parole porte les
// scrutins qu'elle a précédés. Les remonter à leur passage plutôt qu'en pied de
// page, c'est rendre ce que la séance a fait : on discute, puis on vote, puis
// on passe à l'amendement suivant. Une journée compte huit votes en moyenne et
// jusqu'à 83 — les empiler à la fin ne dirait plus de quoi chacun sort.

import { useMemo } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Loader2, Vote } from 'lucide-react';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { ExpandableText } from '@/components/ui/expandable-text';
import { grouperParSujet } from '@/lib/debats';
import { scrutinHref } from '@/lib/scrutin-url';

/** Un vote de la séance, tel que le détail de la réunion le sert. */
export interface ScrutinDeSeance {
  id: string;
  numero: number;
  titre: string;
  date: string;
  sort: string;
  chambre: string;
  session: string;
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
}

interface PriseDeParole {
  id: string;
  type: string;
  contenu: string;
  hasMore: boolean;
  date: string;
  ordre: number | null;
  sourceUrl: string | null;
  orateurNom: string | null;
  orateurPrenom: string | null;
  orateurQualite: string | null;
  orateurGroupe: string | null;
  estPresidence: boolean;
  articleVise: string | null;
  amendementsVises: string[] | null;
  texteNumero: string | null;
  dossier: { uid: string; titre: string } | null;
  scrutinIds: string[];
  parlementaire: {
    id: string;
    slug: string;
    nom: string;
    prenom: string;
    photoUrl: string | null;
    chambre: string;
    groupe: { nom: string; couleur: string | null } | null;
  } | null;
}

interface PageDeDebat {
  data: PriseDeParole[];
  meta: { total: number; hasNext: boolean };
}

const PRISES_PAR_PAGE = 50;

export function DebatDeReunion({
  uid,
  total,
  scrutins,
}: {
  uid: string;
  total: number;
  scrutins?: ScrutinDeSeance[];
}) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteQuery<PageDeDebat>({
      queryKey: ['debat-reunion', uid],
      queryFn: async ({ pageParam = 1 }) => {
        const res = await api.get(`/agenda/${encodeURIComponent(uid)}/debat`, {
          params: { page: pageParam, limit: PRISES_PAR_PAGE },
        });
        return res.data;
      },
      getNextPageParam: (derniere, pages) => (derniere.meta.hasNext ? pages.length + 1 : undefined),
      initialPageParam: 1,
      enabled: total > 0,
    });

  const { loadMoreRef } = useInfiniteScroll({ hasNextPage, isFetchingNextPage, fetchNextPage });

  const prises = useMemo(() => (data?.pages ?? []).flatMap((p) => p.data), [data]);
  const groupes = useMemo(() => grouperParSujet(prises, { avecTexte: true }), [prises]);
  // Défensif : une réponse servie d'un cache antérieur peut ne pas porter le
  // champ. Un vote manquant vaut mieux qu'une page blanche.
  const parId = useMemo(() => new Map((scrutins ?? []).map((s) => [s.id, s])), [scrutins]);

  /**
   * Quel vote s'affiche après quelle prise de parole.
   *
   * Une dizaine de prises peuvent précéder le même scrutin — tout le débat sur
   * un amendement. Le vote ne doit apparaître qu'une fois, après la dernière
   * d'entre elles : c'est là qu'il est tombé. Tant que les pages suivantes ne
   * sont pas chargées, « la dernière connue » suffit, et la position se corrige
   * d'elle-même quand la suite arrive.
   */
  const votesApres = useMemo(() => {
    const derniere = new Map<string, string>();
    for (const prise of prises) {
      for (const id of prise.scrutinIds) derniere.set(id, prise.id);
    }
    const parPrise = new Map<string, ScrutinDeSeance[]>();
    for (const [scrutinId, priseId] of derniere) {
      const scrutin = parId.get(scrutinId);
      if (!scrutin) continue;
      parPrise.set(priseId, [...(parPrise.get(priseId) ?? []), scrutin]);
    }
    return parPrise;
  }, [prises, parId]);

  if (total === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Débat — {total} prise{total > 1 ? 's' : ''} de parole
      </h2>

      {isError && (
        <p className="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          Le débat n&apos;a pas pu être chargé.
        </p>
      )}

      {isLoading && (
        <div className="flex justify-center rounded-lg border bg-card py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {prises.length > 0 && (
        <div className="divide-y rounded-lg border bg-card">
          {groupes.map((groupe) => (
            <div key={groupe.cle}>
              {groupe.titre && (
                <p className="bg-muted/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {groupe.dossier ? (
                    <>
                      <Link
                        href={`/dossiers/${groupe.dossier.uid}`}
                        title={groupe.dossier.titre}
                        className="align-bottom text-primary hover:underline"
                      >
                        {groupe.dossier.titre}
                      </Link>
                      {groupe.sousTitre && <span> · {groupe.sousTitre}</span>}
                    </>
                  ) : (
                    groupe.titre
                  )}
                </p>
              )}

              <div className="divide-y">
                {groupe.interventions.map((prise) => (
                  <div key={prise.id}>
                    <PriseDeParoleItem prise={prise} />
                    {/* Le vote tombe juste après la DERNIÈRE prise qui le
                        porte : c'est l'instant où il a eu lieu. Le mettre en
                        fin de passage l'aurait rejeté très loin — les
                        premières prises d'une séance forment souvent un seul
                        long passage sans sujet déclaré. */}
                    {(votesApres.get(prise.id) ?? []).map((scrutin) => (
                      <ResultatDuVote key={scrutin.id} scrutin={scrutin} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasNextPage && (
        <div ref={loadMoreRef} className="flex justify-center py-6">
          {isFetchingNextPage && (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          )}
        </div>
      )}
    </section>
  );
}

function PriseDeParoleItem({ prise }: { prise: PriseDeParole }) {
  // Le groupe de la fiche quand la personne est résolue ; sinon celui que le
  // compte rendu annonce, seul repère pour une personne auditionnée.
  const groupe = prise.parlementaire?.groupe?.nom ?? prise.orateurGroupe;
  const nom = prise.parlementaire
    ? `${prise.parlementaire.prenom} ${prise.parlementaire.nom}`
    : [prise.orateurPrenom, prise.orateurNom].filter(Boolean).join(' ') || 'Orateur non identifié';
  const href = prise.parlementaire
    ? prise.parlementaire.chambre === 'senat'
      ? `/senateurs/${prise.parlementaire.slug}`
      : `/deputes/${prise.parlementaire.slug}`
    : null;

  return (
    <article className="px-4 py-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        {href ? (
          <Link href={href} className="text-sm font-semibold text-primary hover:underline">
            {nom}
          </Link>
        ) : (
          <span className="text-sm font-semibold">{nom}</span>
        )}
        {groupe && <span className="text-xs text-muted-foreground">{groupe}</span>}
        {prise.orateurQualite && (
          <span className="text-xs italic text-muted-foreground">{prise.orateurQualite}</span>
        )}
      </div>
      <ExpandableText
        text={prise.contenu}
        hasMore={prise.hasMore}
        interventionId={prise.id}
        sourceUrl={prise.sourceUrl}
        maxLines={6}
      />
    </article>
  );
}

/**
 * Le résultat d'un vote, posé dans le fil du débat.
 *
 * On donne les trois chiffres plutôt que le seul verdict : « adopté par 84 voix
 * contre 79 » et « adopté par 400 voix contre 12 » ne racontent pas la même
 * séance.
 */
function ResultatDuVote({ scrutin }: { scrutin: ScrutinDeSeance }) {
  const adopte = scrutin.sort === 'adopte';
  return (
    <Link
      href={scrutinHref(scrutin)}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-indigo-400 bg-indigo-50/60 px-4 py-2.5 transition-colors hover:bg-indigo-100/60 dark:border-indigo-500 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50"
    >
      <Vote className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />
      <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
        Vote n&deg;{scrutin.numero}
      </span>
      <span
        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
          adopte ? 'badge-adopte' : 'badge-rejete'
        }`}
      >
        {adopte ? 'Adopté' : 'Rejeté'}
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">
        {scrutin.nombrePour} pour · {scrutin.nombreContre} contre ·{' '}
        {scrutin.nombreAbstention} abstention{scrutin.nombreAbstention > 1 ? 's' : ''}
      </span>
      <span className="w-full truncate text-xs text-muted-foreground sm:w-auto sm:flex-1">
        {scrutin.titre}
      </span>
    </Link>
  );
}
