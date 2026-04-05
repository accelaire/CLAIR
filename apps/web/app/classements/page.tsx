import type { Metadata } from 'next';
import PageClient from './PageClient';

export const metadata: Metadata = {
  title: 'Classements parlementaires',
  description:
    'Classements des députés et sénateurs par présence, loyauté, amendements et interventions. Comparez les groupes politiques. Données officielles sur CLAIR.vote.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}/classements`,
  },
  openGraph: {
    title: 'Classements parlementaires — CLAIR',
    description:
      'Qui sont les parlementaires les plus actifs ? Comparez présence, loyauté et activité par chambre et groupe politique.',
  },
};

export default function ClassementsPage() {
  return <PageClient />;
}
