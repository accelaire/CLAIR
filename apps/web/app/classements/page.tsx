import type { Metadata } from 'next';
import PageClient from './PageClient';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

const SORT_LABELS: Record<string, string> = {
  presence: 'présence',
  loyaute: 'loyauté',
  amendements: 'amendements',
  interventions: 'interventions',
};

const CHAMBRE_LABELS: Record<string, string> = {
  assemblee: 'Assemblée nationale',
  senat: 'Sénat',
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}): Promise<Metadata> {
  const sort = (searchParams.sort as string) || 'presence';
  const chambre = (searchParams.chambre as string) || '';
  const tab = (searchParams.tab as string) || 'parlementaires';
  const highlight = searchParams.highlight as string | undefined;

  const sortLabel = SORT_LABELS[sort] || 'présence';
  const chambreLabel = chambre ? CHAMBRE_LABELS[chambre] : '';

  // Build OG image URL
  const ogParams = new URLSearchParams();

  if (highlight) {
    ogParams.set('type', 'classement-parlementaire');
    ogParams.set('slug', highlight);
    ogParams.set('sort', sort);
    if (searchParams.rank) ogParams.set('rank', searchParams.rank as string);
  } else if (tab === 'groupes') {
    ogParams.set('type', 'classement-groupes');
    if (chambre) ogParams.set('chambre', chambre);
    ogParams.set('sort', sort);
  } else {
    ogParams.set('type', 'classement');
    ogParams.set('sort', sort);
    if (chambre) ogParams.set('chambre', chambre);
  }

  const ogImageUrl = `${BASE_URL}/api/og?${ogParams.toString()}`;

  // Dynamic title/description
  let title: string;
  let description: string;

  if (highlight) {
    title = `Classement par ${sortLabel}`;
    description = `Découvrez le classement des parlementaires par ${sortLabel}${chambreLabel ? ` (${chambreLabel})` : ''} sur CLAIR.vote.`;
  } else if (tab === 'groupes') {
    title = `Classement des groupes politiques`;
    description = `Comparez les groupes politiques par ${sortLabel}${chambreLabel ? ` (${chambreLabel})` : ''}. Données officielles sur CLAIR.vote.`;
  } else {
    title = `Classement par ${sortLabel}${chambreLabel ? ` — ${chambreLabel}` : ''}`;
    description = `Classement des parlementaires par ${sortLabel}${chambreLabel ? ` (${chambreLabel})` : ''}. Top et flop, données officielles sur CLAIR.vote.`;
  }

  return {
    title,
    description,
    alternates: {
      canonical: `${BASE_URL}/classements`,
    },
    openGraph: {
      title,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default function ClassementsPage() {
  return <PageClient />;
}
