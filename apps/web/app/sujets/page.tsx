import type { Metadata } from 'next';
import PageClient from './PageClient';

export const metadata: Metadata = {
  title: 'Sujets',
  description:
    "Suivez chaque grand texte de loi de bout en bout sur CLAIR.vote : son parcours entre l'Assemblée nationale et le Sénat, les scrutins, les votes par groupe et son issue.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}/sujets`,
  },
  openGraph: {
    title: 'Sujets parlementaires',
    description:
      "Chaque grand texte de loi suivi de son dépôt à son issue : parcours entre l'Assemblée et le Sénat, scrutins et votes par groupe politique.",
  },
};

export default function SujetsPage() {
  return <PageClient />;
}
