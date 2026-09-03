import type { Metadata } from 'next';
import { fetchFromApi } from '@/lib/api-server';
import { VoteEventJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import { scrutinQuery } from '@/lib/scrutin-url';
import { isScrutinAdopte, scrutinSortLabel } from '@/lib/scrutin-sort';
import PageClient from './PageClient';
import type { ScrutinDetail } from './PageClient';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

interface ScrutinSearchParams {
  chambre?: string;
  session?: string;
}

// Au Sénat, le numéro de scrutin n'est pas unique (réinitialisé chaque session) :
// chambre + session doivent être transmis à l'API, sinon elle résout vers le
// scrutin homonyme de l'Assemblée nationale (bug feedback : Sénat n°54 → AN n°54).
async function getScrutin(numero: string, searchParams: ScrutinSearchParams) {
  const query = scrutinQuery({
    chambre: searchParams.chambre,
    session: searchParams.session,
  });
  return fetchFromApi<{ data: ScrutinDetail }>(`/scrutins/${numero}?${query}`);
}

// URL canonique : toujours chambre + session, dans les deux chambres.
//
// Le numéro de scrutin n'est unique nulle part (réinitialisé à chaque session au
// Sénat, à chaque législature à l'Assemblée) : le n°4000 existe en 15e, 16e ET
// 17e. Une canonique « propre » /scrutins/4000 ferait donc déclarer la même URL
// à trois pages distinctes, pointant qui plus est vers un contenu arbitraire
// (l'API résout un numéro nu vers le scrutin le plus récent).
//
// Les URLs propres déjà indexées continuent de répondre et déclarent cette
// canonique explicite : les moteurs consolident vers elle. C'est précisément
// l'usage prévu du canonical pour passer d'URLs ambiguës à des URLs explicites.
function scrutinCanonicalUrl(data: ScrutinDetail): string {
  return `${BASE_URL}/scrutins/${data.numero}?${scrutinQuery(data)}`;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { numero: string };
  searchParams: ScrutinSearchParams;
}): Promise<Metadata> {
  const response = await getScrutin(params.numero, searchParams);
  const data = response?.data;
  if (!data) return {};

  const chambreLabel =
    data.chambre === 'senat' ? 'Sénat' : 'Assemblée nationale';
  const title = `Scrutin n\u00b0${data.numero} — ${data.titre}`;
  const resultLabel = scrutinSortLabel(data.sort);
  const description = `${chambreLabel} — ${resultLabel} (${data.nombrePour} pour, ${data.nombreContre} contre, ${data.nombreAbstention} abstentions). ${data.titre}`;
  const url = scrutinCanonicalUrl(data);
  // L'image OG est servie par un route handler qui doit recevoir chambre+session
  // pour désambiguïser les scrutins du Sénat (numéro non unique entre sessions).
  // URL relative : résolue via metadataBase (cf. layout.tsx), comme les images
  // file-convention des autres pages. Le descripteur reprend les mêmes champs
  // (type/width/height) pour émettre exactement les mêmes balises meta.
  const ogImage = {
    url: `/scrutins/${data.numero}/og?${scrutinQuery(data)}`,
    width: 1200,
    height: 630,
    type: 'image/png',
  };

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ScrutinDetailPage({
  params,
  searchParams,
}: {
  params: { numero: string };
  searchParams: ScrutinSearchParams;
}) {
  const response = await getScrutin(params.numero, searchParams);
  const data = response?.data;
  const canonicalUrl = data ? scrutinCanonicalUrl(data) : '';

  return (
    <>
      {data && (
        <>
          <VoteEventJsonLd
            name={`Scrutin n\u00b0${data.numero} — ${data.titre}`}
            description={data.titre}
            url={canonicalUrl}
            dateCreated={data.date}
            result={isScrutinAdopte(data.sort) ? 'adopted' : 'rejected'}
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
                url: canonicalUrl,
              },
            ]}
          />
        </>
      )}
      <PageClient initialData={response ?? undefined} />
    </>
  );
}
