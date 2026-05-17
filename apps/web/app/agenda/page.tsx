import type { Metadata } from 'next';
import PageClient from './PageClient';

export const metadata: Metadata = {
  title: 'Agenda parlementaire',
  description:
    'Calendrier des réunions de commissions et des séances publiques de l\'Assemblée nationale et du Sénat. Suivez l\'activité parlementaire au jour le jour sur CLAIR.vote.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}/agenda`,
  },
  openGraph: {
    title: 'Agenda parlementaire — CLAIR.vote',
    description:
      'Réunions de commissions et séances publiques en temps réel. Assemblée nationale & Sénat.',
  },
};

export default function AgendaPage() {
  return <PageClient />;
}
