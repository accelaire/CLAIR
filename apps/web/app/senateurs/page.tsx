import type { Metadata } from 'next';
import PageClient from './PageClient';

export const metadata: Metadata = {
  title: 'Sénateurs',
  description:
    'Liste des sénateurs du Sénat français. Recherchez par nom, groupe politique ou département. Votes, présence et activité sur CLAIR.vote.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}/senateurs`,
  },
  openGraph: {
    title: 'Sénateurs — Sénat',
    description:
      'Tous les sénateurs en exercice. Filtrez par groupe, département ou activité.',
  },
};

export default function SenateursPage() {
  return <PageClient />;
}
