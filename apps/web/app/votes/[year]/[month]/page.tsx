import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import { ScrutinListCard } from '@/components/scrutins/ScrutinListCard';
import { Pagination } from '@/components/Pagination';
import {
  MONTH_ARCHIVE_PAGE_SIZE,
  MONTH_NAMES_FR,
  fetchScrutinsPage,
  isValidArchiveYear,
  isValidMonth,
  lastDayOfMonth,
  parsePageParam,
} from '@/lib/scrutins-archive';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

function parseParams(raw: {
  year: string;
  month: string;
}): { year: number; month: number } | null {
  if (!/^\d{4}$/.test(raw.year)) return null;
  if (!/^\d{2}$/.test(raw.month)) return null;
  const year = parseInt(raw.year, 10);
  const month = parseInt(raw.month, 10);
  if (!isValidArchiveYear(year) || !isValidMonth(month)) return null;
  return { year, month };
}

function canonicalUrl(year: number, mm: string, page: number): string {
  const path = `/votes/${year}/${mm}`;
  return page > 1 ? `${BASE_URL}${path}?page=${page}` : `${BASE_URL}${path}`;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { year: string; month: string };
  searchParams: { page?: string };
}): Promise<Metadata> {
  const parsed = parseParams(params);
  if (!parsed) return {};
  const { year, month } = parsed;
  const page = parsePageParam(searchParams?.page);
  const monthName = MONTH_NAMES_FR[month - 1];
  const monthNameCap = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const pageSuffix = page > 1 ? ` — page ${page}` : '';
  const title = `Votes ${monthNameCap} ${year} — Assemblée nationale et Sénat${pageSuffix}`;
  const description = `Tous les scrutins publics de l'Assemblée nationale et du Sénat en ${monthName} ${year}. Résultats des votes, dates et positions par groupe politique.`;
  const url = canonicalUrl(year, params.month, page);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
    robots: page > 1 ? { index: false, follow: true } : undefined,
  };
}

export default async function VotesMonthPage({
  params,
  searchParams,
}: {
  params: { year: string; month: string };
  searchParams: { page?: string };
}) {
  const parsed = parseParams(params);
  if (!parsed) notFound();
  const { year, month } = parsed;
  const currentPage = parsePageParam(searchParams?.page);

  const mm = params.month;
  const dd = lastDayOfMonth(year, month);
  const result = await fetchScrutinsPage({
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(dd).padStart(2, '0')}`,
    page: currentPage,
    limit: MONTH_ARCHIVE_PAGE_SIZE,
  });

  if (result.total === 0) notFound();
  if (currentPage > 1 && result.scrutins.length === 0) notFound();

  const monthName = MONTH_NAMES_FR[month - 1];
  const monthNameCap = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const now = new Date();
  const showPrev = isValidArchiveYear(prevYear);
  const showNext =
    isValidArchiveYear(nextYear) &&
    !(nextYear === now.getFullYear() && nextMonth > now.getMonth() + 1);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Accueil', url: BASE_URL },
          { name: 'Archives des votes', url: `${BASE_URL}/votes` },
          { name: `Votes ${year}`, url: `${BASE_URL}/votes/${year}` },
          {
            name: `${monthNameCap} ${year}`,
            url: `${BASE_URL}/votes/${year}/${mm}`,
          },
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
          <Link
            href={`/votes/${year}`}
            className="hover:text-foreground hover:underline"
          >
            Votes {year}
          </Link>
          {' › '}
          <span className="text-foreground capitalize">{monthName}</span>
        </nav>

        <div className="mb-6">
          <h1 className="text-3xl font-bold">
            Votes {monthNameCap} {year} — Assemblée nationale et Sénat
          </h1>
          <p className="mt-2 text-muted-foreground">
            {result.total > 0
              ? `${result.total.toLocaleString('fr-FR')} scrutins publics`
              : 'Aucun scrutin'}{' '}
            en {monthName} {year}.{' '}
            <Link
              href="/scrutins"
              className="underline hover:text-foreground"
            >
              Voir tous les scrutins
            </Link>
            .
          </p>
        </div>

        {result.scrutins.length > 0 && (
          <div className="space-y-4">
            {result.scrutins.map((s) => (
              <ScrutinListCard key={s.id} scrutin={s} />
            ))}
          </div>
        )}

        <Pagination
          basePath={`/votes/${year}/${mm}`}
          currentPage={result.page}
          totalPages={result.totalPages}
        />

        <nav
          aria-label="Navigation entre les mois"
          className="mt-8 flex justify-between text-sm"
        >
          {showPrev ? (
            <Link
              href={`/votes/${prevYear}/${String(prevMonth).padStart(2, '0')}`}
              className="underline hover:text-foreground"
            >
              ← {MONTH_NAMES_FR[prevMonth - 1]} {prevYear}
            </Link>
          ) : (
            <span />
          )}
          {showNext ? (
            <Link
              href={`/votes/${nextYear}/${String(nextMonth).padStart(2, '0')}`}
              className="underline hover:text-foreground"
            >
              {MONTH_NAMES_FR[nextMonth - 1]} {nextYear} →
            </Link>
          ) : (
            <span />
          )}
        </nav>

        {result.scrutins.length > 0 && (
          <div className="mt-10 border-t pt-6 text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-2">
            <Link
              href={`/votes/${year}`}
              className="underline hover:text-foreground"
            >
              → Tous les votes de {year}
            </Link>
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
