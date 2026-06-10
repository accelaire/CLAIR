import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Suivre un sujet',
  description:
    "Comprendre une page Sujet sur CLAIR : le parcours d'un grand texte de loi entre l'Assemblée et le Sénat, sa chronologie, ses scrutins et les votes par groupe politique.",
};

const steps = [
  {
    step: 1,
    title: 'Choisir un texte',
    description:
      "Depuis la page Sujets, parcourez les grands textes de loi : en cours d'examen, adoptés, rejetés ou promulgués. Chaque sujet réunit un même texte suivi à l'Assemblée et au Sénat.",
  },
  {
    step: 2,
    title: 'Suivre son parcours',
    description:
      "La chronologie législative montre où en est le texte : dépôt, examen à l'Assemblée nationale et au Sénat, adoption ou rejet, puis promulgation.",
  },
  {
    step: 3,
    title: 'Voir qui a voté quoi',
    description:
      "Les scrutins liés et les statistiques par groupe politique montrent comment chaque camp s'est positionné, à l'Assemblée comme au Sénat.",
  },
  {
    step: 4,
    title: 'Remonter à la source',
    description:
      "Les liens vers Légifrance et les dossiers officiels de l'Assemblée et du Sénat permettent de vérifier chaque information directement à la source.",
  },
];

export default function SuivreUnSujetPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
          <FileText className="h-8 w-8 text-primary" />
          Suivre un sujet
        </h1>
        <p className="mt-4 text-muted-foreground">
          Un sujet, c&apos;est un grand texte de loi suivi de bout en bout, de son dépôt
          à son issue, à travers l&apos;Assemblée nationale et le Sénat. Voici comment lire
          sa page en 4 étapes.
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
            href="/sujets"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Commencer &rarr; Voir les sujets
          </Link>
        </div>
      </div>
    </div>
  );
}
