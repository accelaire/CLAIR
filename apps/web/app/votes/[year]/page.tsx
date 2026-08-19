import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import { ScrutinListCard } from '@/components/scrutins/ScrutinListCard';
import { Pagination } from '@/components/Pagination';
import {
  MONTH_NAMES_FR,
  YEAR_ARCHIVE_PAGE_SIZE,
  fetchScrutinsPage,
  isValidArchiveYear,
  parsePageParam,
} from '@/lib/scrutins-archive';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

function parseYear(raw: string): number | null {
  if (!/^\d{4}$/.test(raw)) return null;
  const year = parseInt(raw, 10);
  return isValidArchiveYear(year) ? year : null;
}

function canonicalUrl(year: number, page: number): string {
  const path = `/votes/${year}`;
  return page > 1 ? `${BASE_URL}${path}?page=${page}` : `${BASE_URL}${path}`;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { year: string };
  searchParams: { page?: string };
}): Promise<Metadata> {
  const year = parseYear(params.year);
  if (!year) return {};
  const page = parsePageParam(searchParams?.page);

  const pageSuffix = page > 1 ? ` — page ${page}` : '';
  const title = `Votes ${year} — Assemblée nationale et Sénat${pageSuffix}`;
  const description = `Tous les scrutins publics de l'Assemblée nationale et du Sénat en ${year}. Résultats des votes, dates et positions par groupe politique.`;
  const url = canonicalUrl(year, page);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
    // Only the first page is indexed — subsequent pages are thin duplicates
    // from a content standpoint, but remain followable so Google discovers
    // every scrutin through internal links.
    robots: page > 1 ? { index: false, follow: true } : undefined,
  };
}

export default async function VotesYearPage({
  params,
  searchParams,
}: {
  params: { year: string };
  searchParams: { page?: string };
}) {
  const year = parseYear(params.year);
  if (!year) notFound();
  const currentPage = parsePageParam(searchParams?.page);

  const result = await fetchScrutinsPage({
    from: `${year}-01-01`,
    to: `${year}-12-31`,
    page: currentPage,
    limit: YEAR_ARCHIVE_PAGE_SIZE,
  });

  // Page out of range (e.g. ?page=99 on a year with 2 pages) — send to 404.
  if (currentPage > 1 && result.scrutins.length === 0 && result.total > 0) {
    notFound();
  }

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Accueil', url: BASE_URL },
          { name: 'Archives des votes', url: `${BASE_URL}/votes` },
          { name: `Votes ${year}`, url: `${BASE_URL}/votes/${year}` },
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
            href="/votes"
            className="hover:text-foreground hover:underline"
          >
            Archives des votes
          </Link>
          {' › '}
          <span className="text-foreground">Votes {year}</span>
        </nav>

        <div className="mb-6">
          <h1 className="text-3xl font-bold">
            Votes {year} — Assemblée nationale et Sénat
          </h1>
          <p className="mt-2 text-muted-foreground">
            {result.total > 0
              ? `${result.total.toLocaleString('fr-FR')} scrutins publics`
              : 'Aucun scrutin'}{' '}
            en {year}.{' '}
            <Link
              href="/scrutins"
              className="underline hover:text-foreground"
            >
              Voir tous les scrutins
            </Link>
            .
          </p>
        </div>

        <nav aria-label="Mois de l'année" className="mb-6 flex flex-wrap gap-2">
          {MONTH_NAMES_FR.map((name, idx) => {
            const mm = String(idx + 1).padStart(2, '0');
            return (
              <Link
                key={mm}
                href={`/votes/${year}/${mm}`}
                className="rounded border bg-card px-3 py-1 text-sm capitalize hover:border-primary"
              >
                {name}
              </Link>
            );
          })}
        </nav>

        {result.scrutins.length > 0 && (
          <div className="space-y-4">
            {result.scrutins.map((s) => (
              <ScrutinListCard key={s.id} scrutin={s} />
            ))}
          </div>
        )}

        <Pagination
          basePath={`/votes/${year}`}
          currentPage={result.page}
          totalPages={result.totalPages}
        />

        {result.scrutins.length > 0 && (
          <div className="mt-10 border-t pt-6 text-sm text-muted-foreground">
            <Link
              href="/scrutins"
              className="underline hover:text-foreground"
            >
              → Explorer tous les scrutins (recherche et filtres)
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
