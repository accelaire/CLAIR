'use client';

import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import Link from 'next/link';
import { Vote, Calendar, Loader2, ChevronDown, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { DateRangePicker, dateRangeToParams } from '@/components/DateRangePicker';
import { useUrlDateRange } from '@/hooks/useUrlFilters';
import { ExpandableText } from '@/components/ui/expandable-text';
import { scrutinHref } from '@/lib/scrutin-url';
import { grouperParSujet, libelleDeSeance } from '@/lib/debats';

interface SeanceGroup {
  seanceId: string;
  date: string;
  interventions: {
    id: string;
    date: string;
    type: string;
    contenu: string;
    hasMore: boolean;
    motsCles: string[];
    sourceUrl: string | null;
    ordre: number | null;
    articleVise: string | null;
    amendementsVises: string[] | null;
    texteNumero: string | null;
    dossier: { uid: string; titre: string } | null;
    scrutinIds: string[];
  }[];
  scrutins: {
    id: string;
    numero: number;
    titre: string;
    date: string;
    sort: string;
    chambre: string;
    session: string;
  }[];
}

// Les types viennent de la base, où ils sont écrits sans accent ni espace :
// les afficher tels quels donnait « Explication vote » et « Reponse
// gouvernement ». Ce qui n'est pas nommé ici reste affiché brut plutôt que
// masqué, pour qu'un type ajouté à l'ingestion se voie au lieu de disparaître.
const LIBELLE_TYPE: Record<string, string> = {
  intervention: 'Intervention',
  question: 'Question',
  reponse_gouvernement: 'Réponse du Gouvernement',
  explication_vote: 'Explication de vote',
  interruption: 'Interruption',
};

/** Un vote, en pastille cliquable. */
function ScrutinPuce({
  scrutin,
}: {
  scrutin: { id: string; numero: number; sort: string; chambre: string; session: string; date: string };
}) {
  return (
    <Link
      href={scrutinHref(scrutin)}
      className="inline-flex items-center gap-1.5 rounded bg-indigo-50 px-2 py-1 text-xs text-indigo-600 transition-colors hover:text-indigo-800 hover:underline dark:bg-indigo-950/40 dark:text-indigo-300"
    >
      <Vote className="h-3 w-3" />
      Vote n&deg;{scrutin.numero}
      <span
        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
          scrutin.sort === 'adopte' ? 'badge-adopte' : 'badge-rejete'
        }`}
      >
        {scrutin.sort === 'adopte' ? 'Adopté' : 'Rejeté'}
      </span>
    </Link>
  );
}

function InterventionTypeBadge({ type }: { type: string }) {
  const label = LIBELLE_TYPE[type] ?? type.replace(/_/g, ' ');
  return (
    <span className="rounded bg-muted px-2 py-0.5 text-xs first-letter:capitalize">
      {label}
    </span>
  );
}

export function InterventionsList({
  slug,
  chambre,
}: {
  slug: string;
  chambre: 'assemblee' | 'senat';
}) {
  const apiPrefix = chambre === 'senat' ? 'senateurs' : 'deputes';
  const [dateRange, setDateRange] = useUrlDateRange();
  const dateParams = dateRangeToParams(dateRange);
  // '' = tout ce qui est compté comme prise de parole de fond. Le type
  // `interruption` est proposé à part : ces lignes n'entrent dans aucun
  // compteur et ne s'affichent que si on les demande.
  const [typeFiltre, setTypeFiltre] = useState<string>('');

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['parlementaire-interventions', slug, chambre, dateParams, typeFiltre],
    queryFn: ({ pageParam = 1 }) =>
      api.get(`/${apiPrefix}/${slug}/interventions`, {
        params: {
          page: pageParam,
          limit: 10,
          ...(typeFiltre && { type: typeFiltre }),
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

  const seances: SeanceGroup[] = data?.pages.flatMap((page) => page.data) ?? [];
  const [expandedSeances, setExpandedSeances] = useState<Set<string>>(new Set());

  const toggleSeance = (seanceId: string) => {
    setExpandedSeances((prev) => {
      const next = new Set(prev);
      if (next.has(seanceId)) next.delete(seanceId);
      else next.add(seanceId);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Filtrer par période" />
        <select
          value={typeFiltre}
          onChange={(e) => setTypeFiltre(e.target.value)}
          aria-label="Filtrer par nature de prise de parole"
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Toutes les prises de parole</option>
          <option value="intervention">Interventions</option>
          <option value="question">Questions posées</option>
          <option value="reponse_gouvernement">Réponses du Gouvernement</option>
          <option value="explication_vote">Explications de vote</option>
          <option value="interruption">Interruptions en séance</option>
        </select>
      </div>

      {typeFiltre === 'interruption' && (
        <p className="rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Les interruptions sont de vraies prises de parole, attribuées à leur
          auteur par le compte rendu. Elles n’entrent dans aucun compteur
          d’activité : les mêler aux interventions de fond ajouterait des
          milliers de lignes de chahut à l’activité d’un parlementaire.
        </p>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border p-4">
              <div className="h-4 w-1/4 rounded bg-muted" />
              <div className="mt-3 h-20 w-full rounded bg-muted" />
              <div className="mt-2 h-20 w-full rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : error || seances.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          {typeFiltre
            ? 'Aucune prise de parole de cette nature pour cette période.'
            : 'Aucune intervention trouvée pour cette période.'}
        </p>
      ) : (
        <div className="space-y-6">
          {seances.map((seance) => {
            // Les prises de parole ne portent que l'identifiant de leurs votes ;
            // le détail arrive une fois par séance.
            const scrutinsParId = new Map(seance.scrutins.map((s) => [s.id, s]));
            return (
            <div key={seance.seanceId} className="rounded-lg border bg-card overflow-hidden">
              {/* Séance header — clickable to fold/unfold */}
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b">
                <button
                  onClick={() => toggleSeance(seance.seanceId)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                >
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${!expandedSeances.has(seance.seanceId) ? '-rotate-90' : ''}`} />
                  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <h3 className="text-sm font-semibold truncate">
                    Séance du {libelleDeSeance(seance.date)}
                  </h3>
                </button>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {seance.interventions.length} intervention{seance.interventions.length > 1 ? 's' : ''}
                </span>
              </div>

              {!!expandedSeances.has(seance.seanceId) && (
                <>
                  {/* Lien compte-rendu intégral */}
                  {(() => {
                    const srcUrl = seance.interventions.find((i) => i.sourceUrl)?.sourceUrl;
                    if (!srcUrl) return null;
                    const baseUrl = srcUrl.replace(/#.*$/, '');
                    return (
                      <div className="px-4 py-2 border-b">
                        <a
                          href={baseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                        >
                          Voir le compte-rendu intégral
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    );
                  })()}

                  {/* Interventions, groupées comme la séance les a menées :
                      une séance passe d'un texte à l'autre et d'un article au
                      suivant, et une liste à plat efface ce déroulé. */}
                  <div className="divide-y">
                    {grouperParSujet(seance.interventions, { avecTexte: true }).map((groupe) => (
                      <div key={groupe.cle}>
                        {(groupe.titre || groupe.scrutinIds.length > 0) && (
                          <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 px-4 py-1.5">
                            {groupe.titre && (
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {/* Le texte renvoie à son dossier : c'est là qu'on
                                    lit ce dont il s'agit et où il en est. */}
                                {groupe.dossier ? (
                                  <>
                                    <Link
                                      href={`/dossiers/${groupe.dossier.uid}`}
                                      title={groupe.dossier.titre}
                                      className="inline-block max-w-[26rem] truncate align-bottom text-primary hover:underline"
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
                            {/* Les votes de ce passage précisément, et non ceux
                                de la journée : c'est ce que le rattachement des
                                débats aux scrutins permet enfin de dire. */}
                            {groupe.scrutinIds.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {groupe.scrutinIds
                                  .map((id) => scrutinsParId.get(id))
                                  .filter((s): s is NonNullable<typeof s> => Boolean(s))
                                  .map((scrutin) => (
                                    <ScrutinPuce key={scrutin.id} scrutin={scrutin} />
                                  ))}
                              </div>
                            )}
                          </div>
                        )}
                        {groupe.interventions.map((intervention) => (
                      <div key={intervention.id} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <InterventionTypeBadge type={intervention.type} />
                        </div>
                        <div className="rounded-lg p-3 bg-muted/30">
                          <ExpandableText
                            text={intervention.contenu}
                            hasMore={intervention.hasMore}
                            interventionId={intervention.id}
                            sourceUrl={intervention.sourceUrl}
                          />
                        </div>
                        {intervention.motsCles.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {intervention.motsCles.map((tag) => (
                              <span key={tag} className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Les votes qu'aucune prise de parole ne revendique.
                      Le Sénat n'a pas ce rattachement fin sur les fiches, et une
                      partie des séances de l'Assemblée non plus : on montre alors
                      les votes de la journée, en le disant, plutôt que de laisser
                      croire qu'ils portent sur ce qui vient d'être lu. */}
                  {(() => {
                    const revendiques = new Set(
                      seance.interventions.flatMap((i) => i.scrutinIds ?? []),
                    );
                    const restants = seance.scrutins.filter((s) => !revendiques.has(s.id));
                    if (restants.length === 0) return null;
                    return (
                      <div className="px-4 py-3 bg-muted/30 border-t">
                        <p className="text-xs text-muted-foreground mb-2">
                          {revendiques.size > 0
                            ? 'Autres votes de cette séance :'
                            : 'Votes de cette séance, sans rattachement certain :'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {restants.map((scrutin) => (
                            <ScrutinPuce key={scrutin.id} scrutin={scrutin} />
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
            );
          })}

          {/* Infinite scroll sentinel */}
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
