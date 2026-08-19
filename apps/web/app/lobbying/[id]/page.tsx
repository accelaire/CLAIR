import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchRessource } from '@/lib/api-server';
import { LobbyistJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import PageClient from './PageClient';
import type { LobbyisteDetail } from './PageClient';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

// Rendue à la demande puis conservée, au lieu d'être rejouée à chaque visite.
// Motif et garde-fous dans `lib/liste-ssr`.
export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

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
