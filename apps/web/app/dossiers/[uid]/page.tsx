import type { Metadata } from 'next';
import { fetchFromApi } from '@/lib/api-server';
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import PageClient from './PageClient';
import type { DossierDetail } from './PageClient';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

async function getDossier(uid: string) {
  return fetchFromApi<DossierDetail>(`/dossiers/${uid}`);
}

export async function generateMetadata({
  params,
}: {
  params: { uid: string };
}): Promise<Metadata> {
  const data = await getDossier(params.uid);
  if (!data) return {};

  const titre = data.titreCourt || data.titre;
  const title = titre;
  const chambreLabel =
    data.chambre === 'senat' ? 'Sénat' : 'Assemblée nationale';

  const parts = [
    `Dossier législatif : ${data.titre}`,
    data.procedureLibelle ? `Procédure : ${data.procedureLibelle}` : null,
    data.etat ? `État : ${data.etat}` : null,
    chambreLabel,
    'Scrutins, amendements et débats sur CLAIR.vote.',
  ];
  const description = parts.filter(Boolean).join('. ');
  const url = `${BASE_URL}/dossiers/${data.uid}`;

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

export default async function DossierDetailPage({
  params,
}: {
  params: { uid: string };
}) {
  const data = await getDossier(params.uid);

  return (
    <>
      {data && (
        <BreadcrumbJsonLd
          items={[
            { name: 'Accueil', url: BASE_URL },
            { name: 'Dossiers législatifs', url: `${BASE_URL}/dossiers` },
            {
              name: data.titreCourt || data.titre,
              url: `${BASE_URL}/dossiers/${data.uid}`,
            },
          ]}
        />
      )}
      <PageClient initialData={data ?? undefined} />
    </>
  );
}
