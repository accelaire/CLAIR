import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
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
      card: 'summary_large_image',
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

  // Le sujet n'est pas servi : soit il n'a jamais existé, soit il a été désactivé
  // (137 l'ont été le 2026-07-29, leurs dossiers ayant perdu des scrutins qui ne
  // leur appartenaient pas). Rendre la page quand même produisait un « introuvable »
  // en HTTP 200 — un soft 404 que Google garde indexé.
  if (!data) {
    const archive = await fetchFromApi<{ data: { dossierUid: string | null } }>(
      `/sujets/${params.slug}/archive`,
    );
    const dossierUid = archive?.data?.dossierUid;
    // Un seul dossier derrière le sujet : sa page est le contenu le plus proche
    // de ce que l'URL promettait. Au-delà, aucune cible n'est légitime.
    if (dossierUid) permanentRedirect(`/dossiers/${dossierUid}`);
    notFound();
  }

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
