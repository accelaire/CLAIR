import type { Metadata } from 'next';
import Link from 'next/link';
import { Briefcase } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Comprendre le lobbying | CLAIR',
  description:
    'Parcours guidé pour explorer les représentants d\u2019intérêts et leurs actions sur CLAIR.',
};

const steps = [
  {
    step: 1,
    title: 'Accéder à la page Lobbying',
    description:
      'Rendez-vous sur la page Lobbying pour voir l\u2019ensemble des représentants d\u2019intérêts enregistrés auprès de la HATVP.',
  },
  {
    step: 2,
    title: 'Lire les statistiques générales',
    description:
      'En haut de page, quatre indicateurs : nombre de lobbyistes enregistrés, actions déclarées, budget total déclaré, et nombre de secteurs d\u2019activité représentés.',
  },
  {
    step: 3,
    title: 'Filtrer par secteur ou type',
    description:
      'Utilisez les filtres pour explorer par secteur d\u2019activité (énergie, santé, numérique...) ou par type d\u2019organisation (entreprise, association, syndicat...).',
  },
  {
    step: 4,
    title: 'Consulter une fiche lobbyiste',
    description:
      'Cliquez sur un lobbyiste pour voir ses détails : budget annuel, nombre de lobbyistes employés, actions déclarées, et cibles contactées.',
  },
  {
    step: 5,
    title: 'Croiser avec les parlementaires',
    description:
      'Les actions de lobbying mentionnent souvent le parlementaire ciblé. Cliquez sur son nom pour accéder directement à sa fiche et voir l\u2019ensemble de son activité.',
  },
];

export default function ComprendreLeLobbyingPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
          <Briefcase className="h-8 w-8 text-primary" />
          Comprendre le lobbying
        </h1>
        <p className="mt-4 text-muted-foreground">
          En 5 étapes, apprenez à explorer les représentants d&apos;intérêts et leurs
          actions de lobbying sur CLAIR.
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
            href="/lobbying"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Commencer &rarr; Explorer le lobbying
          </Link>
        </div>
      </div>
    </div>
  );
}
