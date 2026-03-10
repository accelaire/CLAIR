import type { Metadata } from 'next';
import Link from 'next/link';
import { Landmark } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Le Parlement français | CLAIR',
  description:
    'Comprendre le fonctionnement du Parlement français : Assemblée nationale, Sénat, sessions parlementaires et navette législative.',
};

const navetteSteps = [
  {
    step: 1,
    title: 'Dépôt du texte',
    description:
      'Un projet de loi (déposé par le gouvernement) ou une proposition de loi (déposée par un parlementaire) est enregistré auprès d\u2019une des deux chambres.',
  },
  {
    step: 2,
    title: '1re lecture à l\u2019Assemblée nationale',
    description:
      'Le texte est d\u2019abord examiné en commission, puis débattu et voté en séance publique. Les députés peuvent déposer des amendements.',
  },
  {
    step: 3,
    title: '1re lecture au Sénat',
    description:
      'Le texte adopté par l\u2019Assemblée est transmis au Sénat, qui l\u2019examine selon le même processus : commission puis séance.',
  },
  {
    step: 4,
    title: '2e lecture à l\u2019Assemblée nationale',
    description:
      'Si le Sénat a modifié le texte, il revient à l\u2019Assemblée qui se prononce uniquement sur les articles modifiés.',
  },
  {
    step: 5,
    title: '2e lecture au Sénat',
    description:
      'Le Sénat examine à son tour les modifications apportées par l\u2019Assemblée.',
  },
  {
    step: 6,
    title: 'Commission mixte paritaire (CMP)',
    description:
      'En cas de désaccord persistant, une commission de 7 députés et 7 sénateurs tente de trouver un compromis.',
  },
  {
    step: 7,
    title: 'Lecture définitive',
    description:
      'Si la CMP échoue, l\u2019Assemblée nationale a le dernier mot et peut adopter le texte définitivement.',
  },
];

export default function ParlementPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
          <Landmark className="h-8 w-8 text-primary" />
          Le Parlement français
        </h1>

        {/* Bicamérisme */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Qu&apos;est-ce que le Parlement ?</h2>
          <p className="mt-4 text-muted-foreground">
            Le Parlement français est <strong>bicaméral</strong> : il est composé de deux chambres
            qui participent toutes les deux à l&apos;élaboration de la loi.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Assemblée nationale</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                <strong>577 députés</strong> élus au suffrage universel direct pour 5 ans.
                L&apos;Assemblée siège au Palais Bourbon à Paris.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Sénat</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                <strong>348 sénateurs</strong> élus au suffrage universel indirect pour 6 ans
                (renouvelés par moitié tous les 3 ans). Le Sénat siège au Palais du Luxembourg.
              </p>
            </div>
          </div>
        </section>

        {/* Sessions */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Les sessions parlementaires</h2>
          <div className="mt-4 space-y-3 text-muted-foreground">
            <p>
              <strong className="text-foreground">Session ordinaire</strong> : du premier jour ouvrable
              d&apos;octobre au dernier jour ouvrable de juin. C&apos;est la période principale de travail
              parlementaire.
            </p>
            <p>
              <strong className="text-foreground">Sessions extraordinaires</strong> : convoquées par
              le Président de la République, sur un ordre du jour déterminé, en dehors de la session
              ordinaire (généralement en juillet ou septembre).
            </p>
          </div>
        </section>

        {/* Navette parlementaire */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">La navette parlementaire</h2>
          <p className="mt-4 text-muted-foreground">
            Un texte de loi fait des allers-retours entre les deux chambres jusqu&apos;à ce qu&apos;elles
            s&apos;accordent sur une version identique. C&apos;est ce qu&apos;on appelle la
            &laquo; navette parlementaire &raquo;.
          </p>
          <div className="mt-6 space-y-4">
            {navetteSteps.map((s) => (
              <div key={s.step} className="flex gap-4 rounded-lg border bg-card p-4 border-l-4 border-l-primary">
                <span className="text-3xl font-bold text-primary/20">{s.step}</span>
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            href="/deputes"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Explorer les députés
          </Link>
          <Link
            href="/senateurs"
            className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Explorer les sénateurs
          </Link>
        </div>
      </div>
    </div>
  );
}
