'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { Search, ChevronDown, Users } from 'lucide-react';
import { api } from '@/lib/api';

interface Senateur {
  id: string;
  slug: string;
  nom: string;
  prenom: string;
  photoUrl: string | null;
  serie: string | null;
  groupe: {
    slug: string;
    nom: string;
    couleur: string | null;
  } | null;
  circonscription: {
    departement: string;
    numero: number;
    nom: string;
  } | null;
}

interface SenateursResponse {
  data: Senateur[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function SenateursPage() {
  const [search, setSearch] = useState('');
  const [groupe, setGroupe] = useState('');
  const [page, setPage] = useState(1);

  // Fetch sénateurs
  const { data, isLoading, error } = useQuery<SenateursResponse>({
    queryKey: ['senateurs', { search, groupe, page }],
    queryFn: () =>
      api.get('/senateurs', {
        params: { search, groupe: groupe || undefined, page, limit: 24 },
      }).then((res) => res.data),
  });

  // Fetch groupes pour le filtre
  const { data: groupesData } = useQuery({
    queryKey: ['groupes-senat'],
    queryFn: () => api.get('/senateurs/groupes').then((res) => res.data.data),
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Sénateurs</h1>
        <p className="mt-2 text-muted-foreground">
          348 sénateurs au Sénat de la République
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Source : <a href="https://data.senat.fr" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">data.senat.fr</a>
        </p>
      </div>

      {/* Filtres */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row">
        {/* Recherche */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher un sénateur..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border bg-background px-10 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Filtre par groupe */}
        <div className="relative">
          <select
            value={groupe}
            onChange={(e) => {
              setGroupe(e.target.value);
              setPage(1);
            }}
            className="appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tous les groupes</option>
            {groupesData?.map((g: any) => (
              <option key={g.slug} value={g.slug}>
                {g.nom} ({g.membresCount})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Une erreur est survenue lors du chargement des sénateurs.
        </div>
      )}

      {/* Liste des sénateurs */}
      {data && (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            {data.meta.total} résultat{data.meta.total > 1 ? 's' : ''}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.data.map((senateur) => (
              <Link
                key={senateur.id}
                href={`/senateurs/${senateur.slug}`}
                className="group rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  {/* Photo */}
                  <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                    {senateur.photoUrl ? (
                      <Image
                        src={senateur.photoUrl}
                        alt={`${senateur.prenom} ${senateur.nom}`}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <Users className="absolute inset-0 m-auto h-8 w-8 text-muted-foreground" />
                    )}
                  </div>

                  {/* Infos */}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold group-hover:text-primary">
                      {senateur.prenom} {senateur.nom}
                    </h3>

                    {/* Groupe */}
                    {senateur.groupe && (
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: senateur.groupe.couleur || '#888' }}
                        />
                        <span className="truncate text-sm text-muted-foreground">
                          {senateur.groupe.nom}
                        </span>
                      </div>
                    )}

                    {/* Circonscription / Série */}
                    {senateur.circonscription ? (
                      <p className="truncate text-xs text-muted-foreground mt-1">
                        {senateur.circonscription.nom}
                      </p>
                    ) : senateur.serie && (
                      <p className="truncate text-xs text-muted-foreground mt-1">
                        Série {senateur.serie}
                      </p>
                    )}
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
