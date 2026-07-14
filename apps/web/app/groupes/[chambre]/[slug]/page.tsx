import type { Metadata } from 'next';
import { fetchFromApi } from '@/lib/api-server';
import {
  PoliticalGroupJsonLd,
  BreadcrumbJsonLd,
} from '@/components/seo/JsonLd';
import PageClient from './PageClient';
import type { GroupeDetail } from './PageClient';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

// Un sigle de groupe désigne un groupe différent selon la législature (RE, LAREM,
// GDR-NUPES…). `legislature` sélectionne la période ; sans elle, l'API résout la
// plus récente où ce sigle a existé.
interface GroupeSearchParams {
  legislature?: string;
}

async function getGroupe(
  chambre: string,
  slug: string,
  searchParams: GroupeSearchParams = {},
) {
  const query = searchParams.legislature
    ? `?legislature=${encodeURIComponent(searchParams.legislature)}`
    : '';
  return fetchFromApi<{ data: GroupeDetail }>(
    `/groupes/${chambre}/${slug}${query}`,
  );
}

/** URL canonique : porte la législature, sans quoi trois groupes distincts
 *  partageraient la même URL. */
function groupeCanonicalUrl(data: GroupeDetail): string {
  const base = `${BASE_URL}/groupes/${data.chambre}/${data.slug}`;
  return data.legislature != null ? `${base}?legislature=${data.legislature}` : base;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { chambre: string; slug: string };
  searchParams: GroupeSearchParams;
}): Promise<Metadata> {
  const response = await getGroupe(params.chambre, params.slug, searchParams);
  const data = response?.data;
  if (!data) return {};

  const chambreLabel =
    data.chambre === 'senat' ? 'Sénat' : 'Assemblée nationale';
  const title = `${data.nomComplet || data.nom} — ${chambreLabel}`;
  const preposition =
    data.chambre === 'senat' ? 'au Sénat' : "à l'Assemblée nationale";
  const description = `Groupe ${data.nomComplet || data.nom} ${preposition}. ${data.membresActifsCount} membres. Votes, positions et statistiques sur CLAIR.vote.`;
  const url = groupeCanonicalUrl(data);

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

export default async function GroupeDetailPage({
  params,
  searchParams,
}: {
  params: { chambre: string; slug: string };
  searchParams: GroupeSearchParams;
}) {
  const response = await getGroupe(params.chambre, params.slug, searchParams);
  const data = response?.data;

  const chambreLabel =
    data?.chambre === 'senat' ? 'Sénat' : 'Assemblée nationale';

  return (
    <>
      {data && (
        <>
          <PoliticalGroupJsonLd
            name={data.nomComplet || data.nom}
            alternateName={data.nomComplet ? data.nom : undefined}
            url={`${BASE_URL}/groupes/${data.chambre}/${data.slug}`}
            logo={data.logoUrl || undefined}
            description={`Groupe politique — ${chambreLabel} — ${data.membresActifsCount} membres`}
            memberOf={chambreLabel}
          />
          <BreadcrumbJsonLd
            items={[
              { name: 'Accueil', url: BASE_URL },
              { name: 'Groupes politiques', url: `${BASE_URL}/groupes` },
              {
                name: data.nomComplet || data.nom,
                url: `${BASE_URL}/groupes/${data.chambre}/${data.slug}`,
              },
            ]}
          />
        </>
      )}
      <PageClient initialData={response ?? undefined} />
    </>
  );
}
