import type { Metadata } from 'next';
import { fetchFromApi } from '@/lib/api-server';
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import PageClient from './PageClient';
import type { SujetDetail } from './PageClient';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

async function getSujet(slug: string) {
  return fetchFromApi<{ data: SujetDetail }>(`/sujets/${slug}`);
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const response = await getSujet(params.slug);
  const data = response?.data;
  if (!data) return {};

  const title = data.label;
  const desc =
    data.description ||
    data.resume ||
    `Sujet politique : ${data.label}. ${data.dossierCount} dossier${data.dossierCount > 1 ? 's' : ''} législatif${data.dossierCount > 1 ? 's' : ''}, ${data.scrutinCount} scrutin${data.scrutinCount > 1 ? 's' : ''}.`;
  const description = `${desc} Suivez les votes et dossiers sur CLAIR.vote.`;
  const url = `${BASE_URL}/sujets/${data.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function SujetDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const response = await getSujet(params.slug);
  const data = response?.data;

  return (
    <>
      {data && (
        <BreadcrumbJsonLd
          items={[
            { name: 'Accueil', url: BASE_URL },
            { name: 'Sujets', url: `${BASE_URL}/sujets` },
            {
              name: data.label,
              url: `${BASE_URL}/sujets/${data.slug}`,
            },
          ]}
        />
      )}
      <PageClient initialData={response ?? undefined} />
    </>
  );
}
