import type { Metadata } from 'next';
import Link from 'next/link';
import { Vote } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Le scrutin public | CLAIR',
  description:
    'Comprendre les scrutins publics : types de vote, déroulement, lecture des résultats.',
};

export default function ScrutinPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
          <Vote className="h-8 w-8 text-primary" />
          Le scrutin public
        </h1>

        {/* Définition */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Qu&apos;est-ce qu&apos;un scrutin public ?</h2>
          <div className="mt-4 space-y-3 text-muted-foreground">
            <p>
              Un scrutin public est un vote formel où le choix de chaque parlementaire est
              <strong className="text-foreground"> enregistré individuellement</strong>. Contrairement
              au vote à main levée (où seul le résultat global est constaté), le scrutin public
              permet de savoir précisément qui a voté quoi.
            </p>
            <p>
              C&apos;est grâce aux scrutins publics que CLAIR peut afficher le détail des votes
              par parlementaire et par groupe.
            </p>
          </div>
        </section>

        {/* Types */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Les types de scrutin</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Vote solennel</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Porte sur l&apos;ensemble d&apos;un texte de loi. Tous les parlementaires sont
                convoqués. C&apos;est le vote le plus important et le plus médiatisé.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Vote ordinaire</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Porte sur un article, un amendement ou une motion en séance. Plus fréquent
                et souvent plus technique que le vote solennel.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Motion</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Procédure spécifique : motion de censure (renverser le gouvernement), motion de
                rejet préalable (refuser de débattre), question de confiance.
              </p>
            </div>
          </div>
        </section>

        {/* Lire un résultat */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Comment lire un résultat</h2>
          <div className="mt-4 space-y-3 text-muted-foreground">
            <p>
              Chaque parlementaire peut voter dans l&apos;une de ces quatre positions :
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-card p-4">
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                  Pour
                </span>
                <p className="mt-2 text-sm">Le parlementaire approuve le texte soumis au vote.</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                  Contre
                </span>
                <p className="mt-2 text-sm">Le parlementaire s&apos;oppose au texte.</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                  Abstention
                </span>
                <p className="mt-2 text-sm">Le parlementaire ne se prononce ni pour ni contre.</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  Absent
                </span>
                <p className="mt-2 text-sm">Le parlementaire n&apos;a pas pris part au vote.</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Les suffrages exprimés</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Les suffrages exprimés = <strong>pour + contre</strong>. Les abstentions et les absences
                ne comptent pas. Un texte est adopté si les &laquo; pour &raquo; dépassent les
                &laquo; contre &raquo; parmi les suffrages exprimés.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="mt-12">
          <Link
            href="/scrutins"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Explorer les scrutins
          </Link>
        </div>
      </div>
    </div>
  );
}
