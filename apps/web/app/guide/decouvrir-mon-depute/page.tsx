import type { Metadata } from 'next';
import Link from 'next/link';
import { User } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Découvrir mon député | CLAIR',
  description:
    'Parcours guidé pour trouver votre député et comprendre son activité parlementaire sur CLAIR.',
};

const steps = [
  {
    step: 1,
    title: 'Trouver votre député',
    description:
      'Rendez-vous sur la page Députés. Utilisez la barre de recherche par nom, ou filtrez par groupe politique, département ou commission.',
  },
  {
    step: 2,
    title: 'Lire la fiche',
    description:
      'La fiche affiche la photo, le groupe politique, la circonscription, les contacts et liens officiels du député.',
  },
  {
    step: 3,
    title: 'Comprendre les statistiques',
    description:
      'Quatre indicateurs clés : présence solennelle (% de votes solennels où il/elle a voté), loyauté au groupe (% d\u2019alignement avec son groupe), nombre de votes, nombre d\u2019interventions en séance.',
  },
  {
    step: 4,
    title: 'Explorer les votes',
    description:
      'L\u2019onglet « Votes récents » liste tous les scrutins publics auxquels votre député a participé. Vous pouvez filtrer les votes dissidents (quand le député vote différemment de son groupe).',
  },
  {
    step: 5,
    title: 'Comparer',
    description:
      'Cliquez sur « Comparer avec un autre député » pour mettre en regard deux fiches côte à côte : statistiques, votes, et positionnement politique.',
  },
];

export default function DecouvrirMonDeputePage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
          <User className="h-8 w-8 text-primary" />
          Découvrir mon député
        </h1>
        <p className="mt-4 text-muted-foreground">
          En 5 étapes, apprenez à trouver votre député et à comprendre son activité
          parlementaire sur CLAIR.
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
            Commencer &rarr; Explorer les députés
          </Link>
        </div>
      </div>
    </div>
  );
}
