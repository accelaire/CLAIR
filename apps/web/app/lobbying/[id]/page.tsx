import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchRessource } from '@/lib/api-server';
import { LobbyistJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import PageClient from './PageClient';
import type { LobbyisteDetail } from './PageClient';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

// Cette page NE PEUT PAS être générée statiquement, malgré l'absence de
// paramètre d'URL dans son propre code : son `PageClient` appelle directement `useUrlFilters`.
// Un `useSearchParams` non enveloppé d'une `<Suspense>` fait sortir tout le
// rendu statique en « deopted into client-side rendering », ce qui répond 500.
//
// L'enrober d'une `<Suspense>` lèverait le 500 mais servirait le squelette à la
// place du contenu — précisément la panne SEO décrite dans `lib/liste-ssr`. Le
// rendu à la demande est donc le bon régime ici ; le cache edge de `vercel.json`
// est ce qui l'amortit.

async function getLobbyiste(id: string) {
  return fetchRessource<{ data: LobbyisteDetail }>(`/lobbying/${id}`);
}

const typeLabels: Record<string, string> = {
  entreprise: 'Entreprise',
  association: 'Association',
  cabinet: 'Cabinet de conseil',
  syndicat: 'Syndicat',
  organisation_pro: 'Organisation professionnelle',
};

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const response = await getLobbyiste(params.id);
  const data = response?.data;
  if (!data) return {};

  const title = `${data.nom} — Lobbying`;
  const typeLabel = data.type ? typeLabels[data.type] || data.type : null;

  const parts = [
    data.nom,
    typeLabel,
    data.secteur ? `Secteur : ${data.secteur}` : null,
    data.actions?.length
      ? `${data.actions.length} action${data.actions.length > 1 ? 's' : ''} de lobbying`
      : null,
    'Données HATVP sur CLAIR.vote.',
  ];
  const description = parts.filter(Boolean).join('. ');
  const url = `${BASE_URL}/lobbying/${data.id}`;

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

export default async function LobbyisteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const response = await getLobbyiste(params.id);
  const data = response?.data;

  // Sans ça, un identifiant inconnu rendait la coquille du client en HTTP 200 :
  // un soft 404 que Google indexe puis garde. `fetchRessource` ne renvoie
  // `null` que sur un vrai 404 de l'API, jamais sur une panne.
  if (!data) notFound();

  return (
    <>
      {data && (
        <>
          <LobbyistJsonLd
            name={data.nom}
            url={`${BASE_URL}/lobbying/${data.id}`}
            description={
              data.secteur ? `${data.nom} — ${data.secteur}` : data.nom
            }
            address={
              data.ville
                ? {
                    addressLocality: data.ville,
                    addressCountry: 'FR',
                  }
                : undefined
            }
            numberOfEmployees={data.nbLobbyistes || undefined}
          />
          <BreadcrumbJsonLd
            items={[
              { name: 'Accueil', url: BASE_URL },
              { name: 'Lobbying', url: `${BASE_URL}/lobbying` },
              {
                name: data.nom,
                url: `${BASE_URL}/lobbying/${data.id}`,
              },
            ]}
          />
        </>
      )}
      <PageClient initialData={response ?? undefined} />
    </>
  );
}
