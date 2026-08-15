import type { Metadata } from 'next';
import PageClient from './PageClient';

export const metadata: Metadata = {
  title: 'Sénatoriales 2026 — le bilan des sortants',
  description:
    'Le 27 septembre 2026, 178 des 348 sièges du Sénat sont renouvelés dans 64 départements. Présence, loyauté, interventions et amendements : le bilan de mandature de chaque sénateur sortant sur CLAIR.vote.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote'}/senatoriales-2026`,
  },
  openGraph: {
    title: 'Sénatoriales du 27 septembre 2026 — CLAIR.vote',
    description:
      '178 sièges renouvelés, 64 départements. Le bilan de six ans de mandat des sénateurs sortants, chiffres à l\'appui.',
  },
};

export default function Senatoriales2026Page() {
  return <PageClient />;
}
