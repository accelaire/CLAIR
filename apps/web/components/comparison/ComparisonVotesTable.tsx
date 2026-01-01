'use client';

import { useState, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
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
  absent: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400', label: 'Absent' },
};

function PositionBadge({ position }: { position: VotePosition }) {
  const style = POSITION_STYLES[position];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
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
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Vote className="h-5 w-5" />
          Votes comparés
          <span className="text-sm font-normal text-muted-foreground">
            ({displayedVotes.length} scrutin{displayedVotes.length > 1 ? 's' : ''})
          </span>
        </h2>

        {/* Filtre divergent */}
        <button
          onClick={() => setDivergentOnly(!divergentOnly)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
            divergentOnly ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'
          }`}
        >
          <Filter className="h-4 w-4" />
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
        <div className="rounded-lg border bg-card overflow-hidden">
          {/* Header */}
          <div
            className="grid gap-4 border-b bg-muted/50 p-3 text-sm font-medium"
            style={{ gridTemplateColumns: `1fr repeat(${parlementaires.length}, 120px)` }}
          >
            <div>Scrutin</div>
            {parlementaires.map((p) => (
              <div key={p.slug} className="text-center">
                {p.prenom} {p.nom.charAt(0)}.
              </div>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y max-h-[500px] overflow-y-auto">
            {displayedVotes.slice(0, 50).map((vote) => (
              <div
                key={vote.scrutin.id}
                className={`grid gap-4 p-3 text-sm hover:bg-muted/30 ${
                  vote.isDivergent ? 'bg-orange-500/5' : ''
                }`}
                style={{ gridTemplateColumns: `1fr repeat(${parlementaires.length}, 120px)` }}
              >
                {/* Scrutin info */}
                <div className="space-y-1">
                  <div className="font-medium line-clamp-2">{vote.scrutin.titre}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(vote.scrutin.date).toLocaleDateString('fr-FR')}
                    <span
                      className={`rounded px-1.5 py-0.5 ${
                        vote.scrutin.sort === 'adopte'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
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
