'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Users, X, Plus, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import {
  ComparisonStatsGrid,
  ComparisonVotesTable,
  ComparisonAmendements,
} from '@/components/comparison';

interface Parlementaire {
  id: string;
  slug: string;
  nom: string;
  prenom: string;
  photoUrl: string | null;
  groupe: {
    nom: string;
    couleur: string | null;
  } | null;
  circonscription: {
    nom: string;
    departement: string;
  } | null;
  stats: {
    presence: number;
    loyaute: number;
    participation: number;
    interventions: number;
    amendements: { proposes: number; adoptes: number };
    questions: number;
  };
}

interface CompareResponse {
  data: Parlementaire[];
}

function ComparerPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const slugsParam = searchParams.get('slugs') || '';
  const slugs = slugsParam.split(',').filter(Boolean);

  // Fetch comparison data
  const { data, isLoading, error } = useQuery<CompareResponse>({
    queryKey: ['deputes-compare', slugs],
    queryFn: () =>
      api.get('/deputes/compare', { params: { slugs: slugsParam } }).then((res) => res.data),
    enabled: slugs.length >= 2,
  });

  const parlementaires = data?.data ?? [];

  // Retirer un parlementaire de la comparaison
  const handleRemove = (slug: string) => {
    const newSlugs = slugs.filter((s) => s !== slug);
    if (newSlugs.length >= 2) {
      router.push(`/deputes/comparer?slugs=${newSlugs.join(',')}`);
    } else {
      router.push('/deputes');
    }
  };

  // Pas assez de slugs
  if (slugs.length < 2) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-orange-500/50 bg-orange-500/10 p-6 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-orange-500" />
          <h2 className="mt-4 text-lg font-semibold">Sélection insuffisante</h2>
          <p className="mt-2 text-muted-foreground">
            Veuillez sélectionner au moins 2 députés pour les comparer.
          </p>
          <Link
            href="/deputes"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la liste
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/deputes"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la liste
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Comparaison de députés</h1>
        <p className="mt-1 text-muted-foreground">
          Comparez les statistiques, votes et amendements
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <p className="mt-4 text-destructive">
            Une erreur est survenue lors du chargement des données.
          </p>
        </div>
      )}

      {/* Content */}
      {parlementaires.length > 0 && (
        <div className="space-y-8">
          {/* Profils */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {parlementaires.map((p) => (
              <div
                key={p.slug}
                className="relative rounded-lg border bg-card p-4 hover:shadow-md transition-shadow"
              >
                {/* Bouton supprimer */}
                <button
                  onClick={() => handleRemove(p.slug)}
                  className="absolute top-2 right-2 rounded-full p-1 hover:bg-muted transition-colors"
                  aria-label={`Retirer ${p.prenom} ${p.nom}`}
                >
                  <X className="h-4 w-4" />
                </button>

                <Link href={`/deputes/${p.slug}`} className="block">
                  <div className="flex flex-col items-center text-center">
                    {/* Photo */}
                    <div className="relative h-20 w-20 overflow-hidden rounded-full bg-muted">
                      {p.photoUrl ? (
                        <Image
                          src={p.photoUrl}
                          alt={`${p.prenom} ${p.nom}`}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <Users className="absolute inset-0 m-auto h-10 w-10 text-muted-foreground" />
                      )}
                    </div>

                    {/* Nom */}
                    <h3 className="mt-3 font-semibold hover:text-primary transition-colors">
                      {p.prenom} {p.nom}
                    </h3>

                    {/* Groupe */}
                    {p.groupe && (
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: p.groupe.couleur || '#888' }}
                        />
                        <span className="text-sm text-muted-foreground">{p.groupe.nom}</span>
                      </div>
                    )}

                    {/* Circonscription */}
                    {p.circonscription && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.circonscription.nom} ({p.circonscription.departement})
                      </p>
                    )}
                  </div>
                </Link>
              </div>
            ))}

            {/* Carte pour ajouter */}
            {parlementaires.length < 4 && (
              <Link
                href={`/deputes?compare=${slugs[0]}`}
                className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/30 p-4 text-muted-foreground hover:border-primary hover:text-primary transition-colors min-h-[180px]"
              >
                <Plus className="h-8 w-8" />
                <span className="mt-2 text-sm">Ajouter un député</span>
              </Link>
            )}
          </div>

          {/* Statistiques comparées */}
          <ComparisonStatsGrid parlementaires={parlementaires} />

          {/* Votes comparés */}
          <ComparisonVotesTable
            parlementaires={parlementaires.map((p) => ({
              slug: p.slug,
              nom: p.nom,
              prenom: p.prenom,
            }))}
            chambre="deputes"
          />

          {/* Amendements */}
          <ComparisonAmendements
            parlementaires={parlementaires.map((p) => ({
              slug: p.slug,
              nom: p.nom,
              prenom: p.prenom,
              stats: p.stats,
            }))}
            chambre="deputes"
          />
        </div>
      )}
    </div>
  );
}

export default function ComparerPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
          </div>
        </div>
      }
    >
      <ComparerPageContent />
    </Suspense>
  );
}
