'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Users, Vote, Building2, Loader2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useDebouncedCallback } from 'use-debounce';

interface SearchResult {
  _type: 'depute' | 'senateur' | 'scrutin' | 'lobbyiste';
  _score: number;
  // Parlementaire fields (député ou sénateur)
  id?: string;
  slug?: string;
  chambre?: 'assemblee' | 'senat';
  nom?: string;
  prenom?: string;
  nomComplet?: string;
  photoUrl?: string;
  groupe?: string;
  groupeCouleur?: string;
  circonscription?: string;
  departement?: string;
  // Scrutin fields
  numero?: number;
  date?: string;
  titre?: string;
  sort?: string;
  typeVote?: string;
  importance?: number;
  // Lobbyiste fields
  type?: string;
  secteur?: string;
}

interface SearchResponse {
  data: SearchResult[];
  meta: {
    query: string;
    counts?: {
      deputes: number;
      scrutins: number;
      lobbyistes: number;
      total: number;
    };
  };
}

const typeConfig = {
  depute: { label: 'Député', icon: Users, color: 'bg-blue-100 text-blue-700' },
  senateur: { label: 'Sénateur', icon: Users, color: 'bg-red-100 text-red-700' },
  scrutin: { label: 'Scrutin', icon: Vote, color: 'bg-purple-100 text-purple-700' },
  lobbyiste: { label: 'Lobbyiste', icon: Building2, color: 'bg-amber-100 text-amber-700' },
};

export default function RecherchePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<'all' | 'deputes' | 'senateurs' | 'scrutins' | 'lobbyistes'>('all');

  // Debounced search
  const debouncedSetQuery = useDebouncedCallback((value: string) => {
    setDebouncedQuery(value);
    if (value) {
      router.replace(`/recherche?q=${encodeURIComponent(value)}`, { scroll: false });
    } else {
      router.replace('/recherche', { scroll: false });
    }
  }, 300);

  useEffect(() => {
    debouncedSetQuery(query);
  }, [query, debouncedSetQuery]);

  // Search query
  const { data, isLoading, isFetching, error } = useQuery<SearchResponse>({
    queryKey: ['search', debouncedQuery, filter],
    queryFn: () =>
      api.get('/search', {
        params: {
          q: debouncedQuery,
          type: filter,
          limit: 30,
        },
      }).then((res) => res.data),
    enabled: debouncedQuery.length >= 2,
  });

  const getResultLink = (result: SearchResult): string => {
    switch (result._type) {
      case 'depute':
      case 'senateur':
        // Router vers la bonne page selon la chambre
        return result.chambre === 'senat'
          ? `/senateurs/${result.slug}`
          : `/deputes/${result.slug}`;
      case 'scrutin':
        return `/scrutins/${result.numero}`;
      case 'lobbyiste':
        return `/lobbying/${result.id}`;
      default:
        return '#';
    }
  };

  // Détermine le type réel basé sur la chambre
  const getDisplayType = (result: SearchResult): 'depute' | 'senateur' | 'scrutin' | 'lobbyiste' => {
    if (result._type === 'depute' || result._type === 'senateur') {
      return result.chambre === 'senat' ? 'senateur' : 'depute';
    }
    return result._type;
  };

  const renderResult = (result: SearchResult) => {
    const displayType = getDisplayType(result);
    const config = typeConfig[displayType];
    const Icon = config.icon;
    const isParlementaire = displayType === 'depute' || displayType === 'senateur';

    return (
      <Link
        key={`${result._type}-${result.id || result.numero}`}
        href={getResultLink(result)}
        className="block rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
      >
        <div className="flex items-start gap-4">
          {isParlementaire && result.photoUrl ? (
            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-muted">
              <Image
                src={result.photoUrl}
                alt={result.nomComplet || `${result.prenom} ${result.nom}`}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className={`p-3 rounded-lg ${config.color}`}>
              <Icon className="h-5 w-5" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
                {config.label}
              </span>
            </div>

            {isParlementaire && (
              <>
                <h3 className="font-semibold">{result.nomComplet || `${result.prenom} ${result.nom}`}</h3>
                {result.groupe && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: result.groupeCouleur || '#888' }}
                    />
                    {result.groupe}
                  </p>
                )}
                {result.circonscription && (
                  <p className="text-xs text-muted-foreground">
                    {result.circonscription} {result.departement && `(${result.departement})`}
                  </p>
                )}
              </>
            )}

            {result._type === 'scrutin' && (
              <>
                <h3 className="font-semibold line-clamp-2">{result.titre}</h3>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span>Scrutin n°{result.numero}</span>
                  <span>•</span>
                  <span className={result.sort === 'adopte' ? 'text-green-600' : 'text-red-600'}>
                    {result.sort === 'adopte' ? 'Adopté' : 'Rejeté'}
                  </span>
                </div>
              </>
            )}

            {result._type === 'lobbyiste' && (
              <>
                <h3 className="font-semibold">{result.nom}</h3>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  {result.type && <span>{result.type}</span>}
                  {result.secteur && (
                    <>
                      <span>•</span>
                      <span>{result.secteur}</span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Recherche</h1>
        <p className="mt-2 text-muted-foreground">
          Trouvez des députés, sénateurs, scrutins et lobbyistes
        </p>
      </div>

      {/* Search input */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full rounded-xl border bg-background px-12 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
          {isFetching && (
            <Loader2 className="absolute right-12 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground animate-spin" />
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { value: 'all', label: 'Tout' },
          { value: 'deputes', label: 'Députés' },
          { value: 'senateurs', label: 'Sénateurs' },
          { value: 'scrutins', label: 'Scrutins' },
          { value: 'lobbyistes', label: 'Lobbyistes' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              filter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            {f.label}
            {data?.meta.counts && f.value !== 'all' && (
              <span className="ml-1 opacity-70">
                ({data.meta.counts[f.value as keyof typeof data.meta.counts] ?? 0})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Results */}
      {!debouncedQuery && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Commencez à taper pour rechercher</p>
          <p className="text-sm mt-1">Minimum 2 caractères</p>
        </div>
      )}

      {debouncedQuery && debouncedQuery.length < 2 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Minimum 2 caractères requis</p>
        </div>
      )}

      {isLoading && debouncedQuery.length >= 2 && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-1/3 rounded bg-muted" />
                  <div className="h-4 w-2/3 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Une erreur est survenue lors de la recherche.
        </div>
      )}

      {data && !isLoading && (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            {data.data.length} résultat{data.data.length > 1 ? 's' : ''} pour &quot;{data.meta.query}&quot;
          </div>

          {data.data.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun résultat trouvé</p>
              <p className="text-sm mt-1">Essayez avec d&apos;autres termes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.data.map(renderResult)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
