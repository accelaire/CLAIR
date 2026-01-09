import { notFound } from 'next/navigation';

// Simulateur 2027 temporairement désactivé - à réactiver quand les programmes seront sortis
export default function SimulateurLayout({
  children: _children,
}: {
  children: React.ReactNode;
}) {
  notFound();
}
