import type { Metadata } from 'next';
import Link from 'next/link';
import { Vote } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Décrypter un scrutin',
  description:
    'Parcours guidé pour lire et analyser un vote parlementaire sur CLAIR.',
};

const steps = [
  {
    step: 1,
    title: 'Choisir un scrutin',
    description:
      'Sur la page Scrutins, parcourez les votes récents ou utilisez les filtres : thématique, chambre (Assemblée ou Sénat), résultat (adopté/rejeté), période.',
  },
  {
    step: 2,
    title: 'Lire la sidebar',
    description:
      'À droite (ou en haut sur mobile), la sidebar affiche les informations essentielles : date, chambre, type de vote (solennel, ordinaire ou motion), résultat, et le dossier législatif associé.',
  },
  {
    step: 3,
    title: 'Analyser les votes',
    description:
      'L\u2019onglet « Votes » montre la répartition pour/contre/abstention/absent, avec le décompte total et les suffrages exprimés (pour + contre).',
  },
  {
    step: 4,
    title: 'Voir la répartition par groupe',
    description:
      'Chaque groupe politique est affiché avec sa position majoritaire et le détail des votes de ses membres. Repérez les groupes divisés ou unanimes.',
  },
  {
    step: 5,
    title: 'Explorer un parlementaire',
    description:
      'Cliquez sur le nom d\u2019un parlementaire pour accéder à sa fiche complète et voir l\u2019ensemble de ses votes, interventions et amendements.',
  },
];

export default function DecrypterUnScrutinPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
          <Vote className="h-8 w-8 text-primary" />
          Décrypter un scrutin
        </h1>
        <p className="mt-4 text-muted-foreground">
          En 5 étapes, apprenez à lire et analyser un vote parlementaire sur CLAIR.
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
            href="/scrutins"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Commencer &rarr; Parcourir les scrutins
          </Link>
        </div>
      </div>
    </div>
  );
}
