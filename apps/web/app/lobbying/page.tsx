import type { Metadata } from 'next';
import PageClient from './PageClient';

export const metadata: Metadata = {
  title: 'Lobbying',
  description:
    'Organisations de lobbying déclarées auprès de la HATVP. Budget, secteurs d\'activité et actions de représentation d\'intérêts sur CLAIR.vote.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}/lobbying`,
  },
  openGraph: {
    title: 'Lobbying — Données HATVP',
    description:
      'Explorez les organisations de lobbying. Filtrez par budget, secteur ou type.',
  },
};

export default function LobbyingPage() {
  return <PageClient />;
}
