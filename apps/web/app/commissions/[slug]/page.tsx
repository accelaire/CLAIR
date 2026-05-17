import type { Metadata } from 'next';
import { fetchFromApi } from '@/lib/api-server';
import PageClient from './PageClient';
import type { CommissionDetail } from './PageClient';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

async function getCommission(slug: string) {
  const res = await fetchFromApi<{ data: CommissionDetail }>(`/commissions/${slug}`);
  return res?.data ?? null;
}

const CHAMBRE_LABELS: Record<string, string> = {
  assemblee: 'Assemblée nationale',
  senat: 'Sénat',
};

const TYPE_LABELS: Record<string, string> = {
  permanente: 'Commission permanente',
  enquete: "Commission d'enquête",
  speciale: 'Commission spéciale',
  mixte_paritaire: 'Commission mixte paritaire',
  autre: 'Autre commission',
};

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const data = await getCommission(params.slug);
  if (!data) return {};

  const chambre = CHAMBRE_LABELS[data.chambre] || data.chambre;
  const type = TYPE_LABELS[data.type] || data.type;
  const title = `${data.nom} — ${chambre}`;
  const description = `${type} de ${chambre}. ${data.nbMembres} membres, ${data.nbReunions} réunions. Suivez l'activité sur CLAIR.vote.`;
  const url = `${BASE_URL}/commissions/${data.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
    },
  };
}

export default async function CommissionDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const data = await getCommission(params.slug);
  return <PageClient initialData={data ?? undefined} slug={params.slug} />;
}
