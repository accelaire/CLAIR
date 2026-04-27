import type { Metadata } from 'next';
import PageClient from './PageClient';

export const metadata: Metadata = {
  title: 'Commissions parlementaires',
  description:
    'Liste des commissions permanentes, d\'enquête et spéciales de l\'Assemblée nationale et du Sénat. Membres, réunions et activité sur CLAIR.vote.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}/commissions`,
  },
  openGraph: {
    title: 'Commissions parlementaires — Assemblée nationale & Sénat',
    description:
      'Toutes les commissions parlementaires : permanentes, d\'enquête, spéciales. Membres et réunions en temps réel.',
  },
};

export default function CommissionsPage() {
  return <PageClient />;
}
