'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Search, ChevronDown, Vote, CheckCircle, XCircle, Calendar, Tag, Building2 } from 'lucide-react';
import { api } from '@/lib/api';

interface Scrutin {
  id: string;
  numero: number;
  chambre: string;
  date: string;
  titre: string;
  sort: string;
  typeVote: string;
  pour: number;
  contre: number;
  abstention: number;
  importance: number;
  tags: string[];
  votesCount?: number;
}

interface ScrutinsResponse {
  data: Scrutin[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const sortLabels: Record<string, { label: string; color: string }> = {
  adopte: { label: 'Adopté', color: 'text-green-600 bg-green-100' },
  rejete: { label: 'Rejeté', color: 'text-red-600 bg-red-100' },
};

const typeLabels: Record<string, string> = {
  solennel: 'Solennel',
  ordinaire: 'Ordinaire',
  motion: 'Motion',
};

const chambreLabels: Record<string, string> = {
  assemblee: 'Assemblée nationale',
  senat: 'Sénat',
};

export default function ScrutinsPage() {
  const [search, setSearch] = useState('');
  const [chambre, setChambre] = useState('');
  const [type, setType] = useState('');
  const [tag, setTag] = useState('');
  const [page, setPage] = useState(1);

  // Fetch scrutins
  const { data, isLoading, error } = useQuery<ScrutinsResponse>({
    queryKey: ['scrutins', { search, chambre, type, tag, page }],
    queryFn: () =>
      api.get('/scrutins', {
        params: {
          search: search || undefined,
          chambre: chambre || undefined,
          type: type || undefined,
          tag: tag || undefined,
          page,
          limit: 20
        },
      }).then((res) => res.data),
  });

  // Fetch tags
  const { data: tagsData } = useQuery({
    queryKey: ['scrutins-tags'],
    queryFn: () => api.get('/scrutins/tags').then((res) => res.data.data),
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Scrutins</h1>
        <p className="mt-2 text-muted-foreground">
          Tous les votes publics de l&apos;Assemblée nationale et du Sénat
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Sources : <a href="https://data.assemblee-nationale.fr" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">data.assemblee-nationale.fr</a>, <a href="https://data.senat.fr" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">data.senat.fr</a>
        </p>
      </div>

      {/* Filtres */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
        {/* Recherche */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher un scrutin..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border bg-background px-10 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Filtre par chambre */}
        <div className="relative">
          <select
            value={chambre}
            onChange={(e) => {
              setChambre(e.target.value);
              setPage(1);
            }}
            className="appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Toutes les chambres</option>
            <option value="assemblee">Assemblée nationale</option>
            <option value="senat">Sénat</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Filtre par type */}
        <div className="relative">
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className="appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tous les types</option>
            <option value="solennel">Solennel</option>
            <option value="ordinaire">Ordinaire</option>
            <option value="motion">Motion</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Filtre par tag */}
        <div className="relative">
          <select
            value={tag}
            onChange={(e) => {
              setTag(e.target.value);
              setPage(1);
            }}
            className="appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Toutes les thématiques</option>
            {tagsData?.map((t: { name: string; count: number }) => (
              <option key={t.name} value={t.name}>
                {t.name} ({t.count})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
              <div className="h-5 w-3/4 rounded bg-muted mb-2" />
              <div className="h-4 w-1/2 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Une erreur est survenue lors du chargement des scrutins.
        </div>
      )}

      {/* Liste des scrutins */}
      {data && (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            {data.meta.total} scrutin{data.meta.total > 1 ? 's' : ''}
          </div>

          <div className="space-y-4">
            {data.data.map((scrutin) => (
              <Link
                key={scrutin.id}
                href={`/scrutins/${scrutin.numero}?chambre=${scrutin.chambre || 'assemblee'}`}
                className="block rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  {/* Infos principales */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-muted-foreground">
                        Scrutin n°{scrutin.numero}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${scrutin.chambre === 'senat' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {chambreLabels[scrutin.chambre] || 'Assemblée nationale'}
                      </span>
                      {scrutin.importance >= 4 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                          Important
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-lg leading-tight mb-2 line-clamp-2">
                      {scrutin.titre}
                    </h3>

                    {/* Meta infos */}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(scrutin.date)}
                      </span>
                      <span className="px-2 py-0.5 bg-muted rounded text-xs">
                        {typeLabels[scrutin.typeVote] || scrutin.typeVote}
                      </span>
                      {scrutin.tags && scrutin.tags.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {scrutin.tags[0]}
                          {scrutin.tags.length > 1 && ` +${scrutin.tags.length - 1}`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Résultat */}
                  <div className="flex items-center gap-4">
                    {/* Votes */}
                    <div className="flex items-center gap-3 text-sm">
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        {scrutin.pour}
                      </span>
                      <span className="flex items-center gap-1 text-red-600">
                        <XCircle className="h-4 w-4" />
                        {scrutin.contre}
                      </span>
                      <span className="text-muted-foreground">
                        {scrutin.abstention} abs.
                      </span>
                    </div>

                    {/* Badge résultat */}
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${sortLabels[scrutin.sort]?.color || 'bg-muted text-muted-foreground'}`}>
                      {sortLabels[scrutin.sort]?.label || scrutin.sort}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {data.meta.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Précédent
              </button>
              <span className="px-4 py-2 text-sm text-muted-foreground">
                Page {page} sur {data.meta.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))}
                disabled={page === data.meta.totalPages}
                className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
