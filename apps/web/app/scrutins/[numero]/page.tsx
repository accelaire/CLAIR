import type { Metadata } from 'next';
import { fetchFromApi } from '@/lib/api-server';
import { VoteEventJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import PageClient from './PageClient';
import type { ScrutinDetail } from './PageClient';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

async function getScrutin(numero: string) {
  return fetchFromApi<{ data: ScrutinDetail }>(`/scrutins/${numero}`);
}

export async function generateMetadata({
  params,
}: {
  params: { numero: string };
}): Promise<Metadata> {
  const response = await getScrutin(params.numero);
  const data = response?.data;
  if (!data) return {};

  const chambreLabel =
    data.chambre === 'senat' ? 'Sénat' : 'Assemblée nationale';
  const title = `Scrutin n\u00b0${data.numero} — ${data.titre}`;
  const resultLabel = data.sort === 'adopté' ? 'Adopté' : 'Rejeté';
  const description = `${chambreLabel} — ${resultLabel} (${data.nombrePour} pour, ${data.nombreContre} contre, ${data.nombreAbstention} abstentions). ${data.titre}`;
  const url = `${BASE_URL}/scrutins/${data.numero}`;

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
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function ScrutinDetailPage({
  params,
}: {
  params: { numero: string };
}) {
  const response = await getScrutin(params.numero);
  const data = response?.data;

  return (
    <>
      {data && (
        <>
          <VoteEventJsonLd
            name={`Scrutin n\u00b0${data.numero} — ${data.titre}`}
            description={data.titre}
            url={`${BASE_URL}/scrutins/${data.numero}`}
            dateCreated={data.date}
            result={data.sort === 'adopté' ? 'adopted' : 'rejected'}
            votesFor={data.nombrePour}
            votesAgainst={data.nombreContre}
            abstentions={data.nombreAbstention}
          />
          <BreadcrumbJsonLd
            items={[
              { name: 'Accueil', url: BASE_URL },
              { name: 'Scrutins', url: `${BASE_URL}/scrutins` },
              {
                name: `Scrutin n\u00b0${data.numero}`,
                url: `${BASE_URL}/scrutins/${data.numero}`,
              },
            ]}
          />
        </>
      )}
      <PageClient initialData={response ?? undefined} />
    </>
  );
}
