'use client';

import { useState, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Vote, Filter, ChevronDown, Loader2, Calendar } from 'lucide-react';
import { api } from '@/lib/api';

type VotePosition = 'pour' | 'contre' | 'abstention' | 'absent';

interface ScrutinVote {
  scrutinId: string;
  position: VotePosition;
  scrutin: {
    id: string;
    numero: number;
    date: string;
    titre: string;
    sort: string;
    tags: string[];
    chambre?: 'assemblee' | 'senat';
    session?: string;
  };
}

interface ParlementaireVotesResponse {
  data: ScrutinVote[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
  };
}

interface ComparisonVotesTableProps {
  parlementaires: Array<{
    slug: string;
    nom: string;
    prenom: string;
  }>;
  chambre: 'deputes' | 'senateurs';
}

const POSITION_STYLES: Record<VotePosition, { bg: string; text: string; label: string }> = {
  pour: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Pour' },
  contre: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Contre' },
  abstention: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'Abstention' },
  absent: { bg: 'bg-gray-100 dark:bg-gray-800/30', text: 'text-gray-500 dark:text-gray-400', label: 'Absent' },
};

function PositionBadge({ position }: { position: VotePosition }) {
  const style = POSITION_STYLES[position];
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 sm:px-2.5 py-0.5 text-[10px] sm:text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

export function ComparisonVotesTable({ parlementaires, chambre }: ComparisonVotesTableProps) {
  const [divergentOnly, setDivergentOnly] = useState(false);

  // Fetch votes pour chaque parlementaire
  const votesQueries = parlementaires.map((p) =>
    useInfiniteQuery<ParlementaireVotesResponse>({
      queryKey: ['parlementaire-votes', p.slug, chambre],
      queryFn: ({ pageParam = 1 }) =>
        api
          .get(`/${chambre}/${p.slug}/votes`, { params: { page: pageParam, limit: 100 } })
          .then((res) => res.data),
      getNextPageParam: (lastPage) => (lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined),
      initialPageParam: 1,
    })
  );

  // Agréger les votes par scrutin
  const { commonVotes, isLoading } = useMemo(() => {
    const allLoading = votesQueries.some((q) => q.isLoading);
    if (allLoading) {
      return { commonVotes: [], isLoading: true };
    }

    // Construire un map des votes par scrutinId pour chaque parlementaire
    const votesMaps = parlementaires.map((p, i) => {
      const votes = votesQueries[i].data?.pages.flatMap((page) => page.data) ?? [];
      const map = new Map<string, ScrutinVote>();
      votes.forEach((v) => map.set(v.scrutinId, v));
      return map;
    });

    // Trouver les scrutins communs (où au moins 2 parlementaires ont voté)
    const allScrutinIds = new Set<string>();
    votesMaps.forEach((map) => {
      map.forEach((_, id) => allScrutinIds.add(id));
    });

    const common: Array<{
      scrutin: ScrutinVote['scrutin'];
      positions: Map<string, VotePosition>;
      isDivergent: boolean;
    }> = [];

    allScrutinIds.forEach((scrutinId) => {
      const positions = new Map<string, VotePosition>();
      let scrutinInfo: ScrutinVote['scrutin'] | null = null;
      let votedCount = 0;

      parlementaires.forEach((p, i) => {
        const vote = votesMaps[i].get(scrutinId);
        if (vote) {
          positions.set(p.slug, vote.position);
          scrutinInfo = vote.scrutin;
          votedCount++;
        }
      });

      // Garder uniquement si au moins 2 ont voté
      if (votedCount >= 2 && scrutinInfo) {
        // Déterminer si les votes sont divergents (positions différentes)
        const uniquePositions = new Set(positions.values());
        const isDivergent = uniquePositions.size > 1;

        common.push({
          scrutin: scrutinInfo,
          positions,
          isDivergent,
        });
      }
    });

    // Trier par date décroissante
    common.sort((a, b) => new Date(b.scrutin.date).getTime() - new Date(a.scrutin.date).getTime());

    return { commonVotes: common, isLoading: false };
  }, [votesQueries, parlementaires]);

  // Filtrer si divergent only
  const displayedVotes = divergentOnly ? commonVotes.filter((v) => v.isDivergent) : commonVotes;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Vote className="h-5 w-5" />
          Votes comparés
        </h2>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold">
          <Vote className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="whitespace-nowrap">Votes comparés</span>
          <span className="text-xs sm:text-sm font-normal text-muted-foreground whitespace-nowrap">
            ({displayedVotes.length} scrutin{displayedVotes.length > 1 ? 's' : ''})
          </span>
        </h2>

        {/* Filtre divergent */}
        <button
          onClick={() => setDivergentOnly(!divergentOnly)}
          className={`flex items-center gap-1.5 sm:gap-2 rounded-lg border px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm transition-colors whitespace-nowrap ${
            divergentOnly ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'
          }`}
        >
          <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
          Divergents seulement
        </button>
      </div>

      {displayedVotes.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          {divergentOnly
            ? 'Aucun vote divergent trouvé entre ces parlementaires'
            : 'Aucun vote commun trouvé'}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          {/* Header */}
          <div
            className="grid gap-2 sm:gap-4 border-b bg-muted/50 p-2 sm:p-3 text-xs sm:text-sm font-medium min-w-fit"
            style={{ gridTemplateColumns: `minmax(140px, 1fr) repeat(${parlementaires.length}, minmax(70px, 100px))` }}
          >
            <div>Scrutin</div>
            {parlementaires.map((p) => (
              <div key={p.slug} className="text-center truncate">
                {p.prenom.charAt(0)}. {p.nom}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y max-h-[500px] overflow-y-auto">
            {displayedVotes.slice(0, 50).map((vote) => (
              <div
                key={vote.scrutin.id}
                className={`grid gap-2 sm:gap-4 p-2 sm:p-3 text-xs sm:text-sm hover:bg-muted/30 min-w-fit ${
                  vote.isDivergent ? 'bg-orange-500/5' : ''
                }`}
                style={{ gridTemplateColumns: `minmax(140px, 1fr) repeat(${parlementaires.length}, minmax(70px, 100px))` }}
              >
                {/* Scrutin info */}
                <div className="space-y-1">
                  <Link
                    href={`/scrutins/${vote.scrutin.numero}?chambre=${vote.scrutin.chambre || (chambre === 'senateurs' ? 'senat' : 'assemblee')}${(vote.scrutin.chambre === 'senat' || chambre === 'senateurs') && vote.scrutin.session ? `&session=${vote.scrutin.session}` : ''}`}
                    className="font-medium line-clamp-2 hover:text-primary hover:underline transition-colors"
                  >
                    {vote.scrutin.titre}
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(vote.scrutin.date).toLocaleDateString('fr-FR')}
                    <span
                      className={`rounded px-1.5 py-0.5 ${
                        vote.scrutin.sort === 'adopte'
                          ? 'badge-adopte'
                          : 'badge-rejete'
                      }`}
                    >
                      {vote.scrutin.sort === 'adopte' ? 'Adopté' : 'Rejeté'}
                    </span>
                  </div>
                </div>

                {/* Positions */}
                {parlementaires.map((p) => (
                  <div key={p.slug} className="flex items-center justify-center">
                    {vote.positions.has(p.slug) ? (
                      <PositionBadge position={vote.positions.get(p.slug)!} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {displayedVotes.length > 50 && (
            <div className="border-t p-3 text-center text-sm text-muted-foreground">
              Affichage des 50 premiers scrutins sur {displayedVotes.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
