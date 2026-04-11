import type { Metadata } from 'next';
import Link from 'next/link';
import { GitCompareArrows } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Comparer des élus',
  description:
    'Parcours guidé pour comparer l\u2019activité de deux parlementaires sur CLAIR.',
};

const steps = [
  {
    step: 1,
    title: 'Ouvrir une fiche',
    description:
      'Rendez-vous sur la fiche d\u2019un député ou d\u2019un sénateur depuis les pages Députés ou Sénateurs.',
  },
  {
    step: 2,
    title: 'Cliquer sur « Comparer »',
    description:
      'En haut de la fiche, cliquez sur le bouton « Comparer avec un autre député/sénateur ». Vous serez redirigé vers la liste avec le mode comparaison activé.',
  },
  {
    step: 3,
    title: 'Sélectionner un second élu',
    description:
      'La liste des parlementaires s\u2019affiche. Cherchez ou filtrez pour trouver l\u2019élu que vous souhaitez comparer.',
  },
  {
    step: 4,
    title: 'Lire la comparaison',
    description:
      'Les statistiques des deux élus sont mises côte à côte : présence, loyauté, participation, amendements. Identifiez les différences de comportement parlementaire.',
  },
];

export default function ComparerDesElusPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
          <GitCompareArrows className="h-8 w-8 text-primary" />
          Comparer des élus
        </h1>
        <p className="mt-4 text-muted-foreground">
          En 4 étapes, apprenez à comparer l&apos;activité de deux parlementaires sur CLAIR.
        </p>

        <div className="mt-10 space-y-6">
          {steps.map((s) => (
            <div key={s.step} className="flex gap-6 rounded-lg border bg-card p-6">
              <span className="text-3xl font-bold text-primary/20">{s.step}</span>
              <div>
                <h2 className="font-semibold">{s.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <Link
            href="/deputes"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Commencer &rarr; Choisir un député
          </Link>
        </div>
      </div>
    </div>
  );
}
