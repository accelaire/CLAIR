import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Suivre un sujet',
  description:
    'Parcours guidé pour rechercher un thème politique et suivre les votes associés sur CLAIR.',
};

const steps = [
  {
    step: 1,
    title: 'Lancer une recherche',
    description:
      'Utilisez la barre de recherche globale (icône loupe dans le header) pour trouver un sujet : « immigration », « énergie », « retraites »...',
  },
  {
    step: 2,
    title: 'Explorer les résultats',
    description:
      'Les résultats affichent les scrutins, dossiers législatifs et parlementaires liés à votre recherche.',
  },
  {
    step: 3,
    title: 'Filtrer les scrutins',
    description:
      'Sur la page Scrutins, utilisez les filtres par thématique (tags) pour affiner. Vous pouvez aussi filtrer par chambre, résultat ou période.',
  },
  {
    step: 4,
    title: 'Voir qui a voté quoi',
    description:
      'Cliquez sur un scrutin pour voir le détail : répartition par groupe, liste des votes individuels, et le dossier législatif associé.',
  },
];

export default function SuivreUnSujetPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
          <Search className="h-8 w-8 text-primary" />
          Suivre un sujet
        </h1>
        <p className="mt-4 text-muted-foreground">
          En 4 étapes, apprenez à rechercher un thème politique et à suivre les votes
          associés sur CLAIR.
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
            href="/recherche"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Commencer &rarr; Lancer une recherche
          </Link>
        </div>
      </div>
    </div>
  );
}
