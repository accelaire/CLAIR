import type { Metadata } from 'next';
import Link from 'next/link';
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import { fetchFromApi } from '@/lib/api-server';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

interface AnneesResponse {
  data: { year: number; count: number }[];
}

export const metadata: Metadata = {
  title: 'Archives des votes — Assemblée nationale et Sénat',
  description:
    "Retrouvez tous les scrutins publics de l'Assemblée nationale et du Sénat, classés par année et par mois. Résultats des votes et positions par groupe politique sur CLAIR.vote.",
  alternates: { canonical: `${BASE_URL}/votes` },
  openGraph: {
    title: 'Archives des votes parlementaires — CLAIR.vote',
    description:
      "Tous les votes de l'Assemblée nationale et du Sénat classés par année.",
    url: `${BASE_URL}/votes`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Archives des votes parlementaires — CLAIR.vote',
    description:
      "Tous les votes de l'Assemblée nationale et du Sénat classés par année.",
  },
};

export default async function VotesIndexPage() {
  const res = await fetchFromApi<AnneesResponse>('/scrutins/annees', 86400);
  const annees = res?.data ?? [];

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Accueil', url: BASE_URL },
          { name: 'Scrutins', url: `${BASE_URL}/scrutins` },
          { name: 'Archives des votes', url: `${BASE_URL}/votes` },
        ]}
      />
      <div className="container mx-auto px-4 py-8">
        <nav
          aria-label="Fil d'Ariane"
          className="mb-4 text-sm text-muted-foreground"
        >
          <Link href="/" className="hover:text-foreground hover:underline">
            Accueil
          </Link>
          {' › '}
          <Link
            href="/scrutins"
            className="hover:text-foreground hover:underline"
          >
            Scrutins
          </Link>
          {' › '}
          <span className="text-foreground">Archives des votes</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">Archives des votes parlementaires</h1>
          <p className="mt-2 text-muted-foreground">
            Tous les scrutins publics de l&apos;Assemblée nationale et du Sénat,
            classés par année.{' '}
            <Link href="/scrutins" className="underline hover:text-foreground">
              Utiliser la recherche et les filtres
            </Link>
            .
          </p>
        </div>

        {annees.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {annees.map(({ year, count }) => (
              <li key={year}>
                <Link
                  href={`/votes/${year}`}
                  className="flex flex-col items-center justify-center rounded-lg border bg-card px-4 py-6 transition-all hover:border-primary hover:shadow-md"
                >
                  <span className="text-lg font-semibold">{year}</span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    {count.toLocaleString('fr-FR')} scrutins
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Aucune donnée disponible.</p>
        )}
      </div>
    </>
  );
}
