import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { SORTSList } from '@/components/SORTSList';

export const metadata: Metadata = {
  title: 'Le dossier législatif',
  description:
    "Comprendre le cycle de vie d'une loi : de la proposition à la promulgation, en passant par les amendements.",
};

const cycleSteps = [
  {
    step: 1,
    title: 'Initiative',
    description:
      'Un projet de loi (déposé par le gouvernement) ou une proposition de loi (déposée par un parlementaire) est enregistré.',
  },
  {
    step: 2,
    title: 'Examen en commission',
    description:
      "La commission permanente compétente examine le texte : auditions d'experts, débats, adoption d'amendements, vote en commission.",
  },
  {
    step: 3,
    title: 'Discussion en séance publique',
    description:
      'Le texte est débattu dans l\'hémicycle. Les parlementaires défendent leurs amendements et votent article par article.',
  },
  {
    step: 4,
    title: 'Navette parlementaire',
    description:
      'Le texte fait des allers-retours entre l\'Assemblée nationale et le Sénat jusqu\'à accord sur une version identique.',
  },
  {
    step: 5,
    title: 'Commission mixte paritaire',
    description:
      'En cas de désaccord persistant, 7 députés et 7 sénateurs tentent de trouver un compromis.',
  },
  {
    step: 6,
    title: 'Promulgation',
    description:
      'Le Président de la République promulgue la loi, qui est publiée au Journal Officiel et entre en vigueur.',
  },
];

export default function DossierLegislatifPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
          <FileText className="h-8 w-8 text-primary" />
          Le dossier législatif
        </h1>

        {/* Cycle de vie */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Le cycle de vie d&apos;une loi</h2>
          <p className="mt-4 text-muted-foreground">
            De l&apos;idée initiale à la publication au Journal Officiel, un texte de loi
            traverse plusieurs étapes clés.
          </p>
          <div className="mt-6 space-y-4">
            {cycleSteps.map((s) => (
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

        {/* Amendements */}
        <section id="amendements-sort" className="mt-10 scroll-mt-8">
          <h2 className="text-2xl font-bold">Les amendements</h2>
          <div className="mt-4 space-y-3 text-muted-foreground">
            <p>
              Un amendement est une <strong className="text-foreground">proposition de modification</strong> d&apos;un
              texte de loi. Il peut être déposé par un parlementaire ou par le gouvernement, à n&apos;importe
              quelle étape de la discussion.
            </p>

            <SORTSList />
          </div>
          <p className="mt-4">
            <strong className="text-foreground">Rectification</strong> : l&apos;auteur d&apos;un amendement
            peut le modifier avant le vote. L&apos;amendement modifié est alors marqué comme &quot;Rect&quot; dans la numérotation.
          </p>
        </section>

        {/* États sur CLAIR */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Les états sur CLAIR</h2>
          <p className="mt-4 text-muted-foreground">
            Sur CLAIR, chaque dossier législatif affiche un état reflétant l&apos;avancement du texte.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <span className="inline-flex px-2 py-0.5 text-xs rounded-full badge-en-cours">
                En cours
              </span>
              <p className="mt-2 text-sm text-muted-foreground">
                Le texte est en cours d&apos;examen parlementaire.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                Adopté
              </span>
              <p className="mt-2 text-sm text-muted-foreground">
                Le texte a été adopté par les deux chambres.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <span className="inline-flex px-2 py-0.5 text-xs rounded-full badge-rejete">
                Rejeté
              </span>
              <p className="mt-2 text-sm text-muted-foreground">
                Le texte a été rejeté par l&apos;une des chambres.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <span className="inline-flex px-2 py-0.5 text-xs rounded-full badge-promulgue">
                Promulgué
              </span>
              <p className="mt-2 text-sm text-muted-foreground">
                La loi a été promulguée par le Président et publiée au Journal Officiel.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="mt-12">
          <Link
            href="/dossiers"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Explorer les dossiers législatifs
          </Link>
        </div>
      </div>
    </div>
  );
}
