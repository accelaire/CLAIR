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
  }[];
  scrutins: {
    id: string;
    numero: number;
    titre: string;
    date: string;
    sort: string;
    chambre: string;
  }[];
}

function InterventionTypeBadge({ type }: { type: string }) {
  const label = type.replace('_', ' ');
  return (
    <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">
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

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['parlementaire-interventions', slug, chambre, dateParams],
    queryFn: ({ pageParam = 1 }) =>
      api.get(`/${apiPrefix}/${slug}/interventions`, {
        params: {
          page: pageParam,
          limit: 10,
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
      <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Filtrer par période" />

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
          Aucune intervention trouvée pour cette période.
        </p>
      ) : (
        <div className="space-y-6">
          {seances.map((seance) => (
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
                    Séance du{' '}
                    {new Date(seance.date).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
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

                  {/* Interventions */}
                  <div className="divide-y">
                    {seance.interventions.map((intervention) => (
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

                  {/* Scrutins liés */}
                  {seance.scrutins.length > 0 && (
                    <div className="px-4 py-3 bg-muted/30 border-t">
                      <p className="text-xs text-muted-foreground mb-2">Scrutins liés :</p>
                      <div className="flex flex-wrap gap-2">
                        {seance.scrutins.map((scrutin) => (
                          <Link
                            key={scrutin.id}
                            href={`/scrutins/${scrutin.numero}${chambre === 'senat' ? '?chambre=senat' : ''}`}
                            className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:underline bg-indigo-50 px-2 py-1 rounded transition-colors"
                          >
                            <Vote className="h-3 w-3" />
                            Vote n&deg;{scrutin.numero}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              scrutin.sort === 'adopte' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {scrutin.sort === 'adopte' ? 'Adopté' : 'Rejeté'}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

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
