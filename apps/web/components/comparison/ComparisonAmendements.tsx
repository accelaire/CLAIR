'use client';

import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { FileText, ChevronDown, ChevronUp, Loader2, Calendar, CheckCircle, XCircle, MinusCircle } from 'lucide-react';
import { api } from '@/lib/api';

type AmendementSort = 'Adopté' | 'Rejeté' | 'Retiré' | 'Non soutenu' | 'Tombé';

interface Amendement {
  id: string;
  uid: string;
  numero: string;
  articleVise: string | null;
  exposeSommaire: string | null;
  dispositif: string | null;
  sort: AmendementSort | null;
  dateDepot: string | null;
  dateSort: string | null;
}

interface AmendementsResponse {
  data: Amendement[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
  };
}

interface ParlementaireWithStats {
  slug: string;
  nom: string;
  prenom: string;
  stats: {
    amendements: { proposes: number; adoptes: number };
  };
}

interface ComparisonAmendementsProps {
  parlementaires: ParlementaireWithStats[];
  chambre: 'deputes' | 'senateurs';
}

const SORT_STYLES: Record<AmendementSort, { icon: React.ReactNode; color: string }> = {
  'Adopté': { icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-600 dark:text-green-400' },
  'Rejeté': { icon: <XCircle className="h-4 w-4" />, color: 'text-red-600 dark:text-red-400' },
  'Retiré': { icon: <MinusCircle className="h-4 w-4" />, color: 'text-yellow-600 dark:text-yellow-400' },
  'Non soutenu': { icon: <MinusCircle className="h-4 w-4" />, color: 'text-gray-500' },
  'Tombé': { icon: <MinusCircle className="h-4 w-4" />, color: 'text-gray-500' },
};

function ParlementaireAmendements({
  parlementaire,
  chambre,
}: {
  parlementaire: ParlementaireWithStats;
  chambre: 'deputes' | 'senateurs';
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery<AmendementsResponse>({
      queryKey: ['parlementaire-amendements', parlementaire.slug, chambre],
      queryFn: ({ pageParam = 1 }) =>
        api
          .get(`/${chambre}/${parlementaire.slug}/amendements`, { params: { page: pageParam, limit: 10 } })
          .then((res) => res.data),
      getNextPageParam: (lastPage) => (lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined),
      initialPageParam: 1,
      enabled: isExpanded,
    });

  const amendements = data?.pages.flatMap((page) => page.data) ?? [];
  const { proposes, adoptes } = parlementaire.stats.amendements;
  const tauxAdoption = proposes > 0 ? Math.round((adoptes / proposes) * 100) : 0;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header avec stats */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">
              {parlementaire.prenom} {parlementaire.nom}
            </h3>
            <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
              <span>{proposes} proposés</span>
              <span className="text-green-600 dark:text-green-400">{adoptes} adoptés</span>
              <span className="font-medium">({tauxAdoption}% adoption)</span>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        {/* Barre de progression */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${tauxAdoption}%` }}
          />
        </div>
      </button>

      {/* Liste des amendements */}
      {isExpanded && (
        <div className="border-t">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : amendements.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Aucun amendement trouvé
            </div>
          ) : (
            <>
              <div className="divide-y max-h-[400px] overflow-y-auto">
                {amendements.map((amendement) => (
                  <div key={amendement.id} className="p-4 hover:bg-muted/30">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">N° {amendement.numero}</span>
                          {amendement.articleVise && (
                            <span className="text-sm text-muted-foreground">
                              Art. {amendement.articleVise}
                            </span>
                          )}
                        </div>
                        {amendement.exposeSommaire && (
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                            {amendement.exposeSommaire}
                          </p>
                        )}
                        {amendement.dateDepot && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(amendement.dateDepot).toLocaleDateString('fr-FR')}
                          </div>
                        )}
                      </div>

                      {/* Sort status */}
                      {amendement.sort && (
                        <div
                          className={`flex items-center gap-1 text-sm font-medium ${
                            SORT_STYLES[amendement.sort]?.color || 'text-muted-foreground'
                          }`}
                        >
                          {SORT_STYLES[amendement.sort]?.icon}
                          <span>{amendement.sort}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Load more */}
              {hasNextPage && (
                <div className="border-t p-3">
                  <button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="w-full rounded-lg border py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    {isFetchingNextPage ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Chargement...
                      </span>
                    ) : (
                      'Voir plus'
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ComparisonAmendements({ parlementaires, chambre }: ComparisonAmendementsProps) {
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <FileText className="h-5 w-5" />
        Amendements
      </h2>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {parlementaires.map((p) => (
          <ParlementaireAmendements key={p.slug} parlementaire={p} chambre={chambre} />
        ))}
      </div>
    </div>
  );
}
