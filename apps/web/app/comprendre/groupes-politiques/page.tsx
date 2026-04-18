import type { Metadata } from 'next';
import Link from 'next/link';
import { Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Les groupes politiques',
  description:
    'Comprendre les groupes parlementaires : différence avec les partis, rôle, cohésion et loyauté.',
};

export default function GroupesPolitiquesPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
          <Users className="h-8 w-8 text-primary" />
          Les groupes politiques
        </h1>

        {/* Groupe ≠ Parti */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Groupe parlementaire ≠ parti politique</h2>
          <div className="mt-4 space-y-3 text-muted-foreground">
            <p>
              Le <strong className="text-foreground">groupe parlementaire</strong> est une structure
              interne à l&apos;assemblée. C&apos;est l&apos;unité d&apos;organisation du travail
              parlementaire : il répartit le temps de parole, siège dans les commissions et coordonne
              les positions de vote.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border bg-card p-4">
                <h3 className="font-semibold">Seuils minimum</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-inside list-disc">
                  <li><strong>Assemblée nationale</strong> : 15 députés minimum</li>
                  <li><strong>Sénat</strong> : 10 sénateurs minimum</li>
                </ul>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <h3 className="font-semibold">Non-inscrits</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Les parlementaires qui n&apos;appartiennent à aucun groupe sont dits
                  &laquo; non-inscrits &raquo;. Ils disposent de moins de temps de parole et de
                  postes en commission.
                </p>
              </div>
            </div>
            <p>
              Le <strong className="text-foreground">parti politique</strong> est une organisation
              extérieure au Parlement. Un même parti peut avoir des élus dans plusieurs groupes, et un
              groupe peut rassembler des élus de différents partis.
            </p>
          </div>
        </section>

        {/* Rôle des groupes */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Le rôle des groupes</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Temps de parole</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Le temps de parole en séance est réparti entre les groupes proportionnellement
                à leur taille.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Commissions</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Les postes dans les commissions permanentes sont distribués proportionnellement
                entre les groupes.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Scrutins publics</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Un groupe peut demander un scrutin public sur un texte, obligeant chaque
                parlementaire à se prononcer individuellement.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Expression dans les débats</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Chaque groupe désigne un orateur pour les discussions générales et les
                explications de vote.
              </p>
            </div>
          </div>
        </section>

        {/* Cohésion et loyauté */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Cohésion et loyauté</h2>
          <div className="mt-4 space-y-3 text-muted-foreground">
            <p>
              Sur CLAIR, la <strong className="text-foreground">loyauté au groupe</strong> mesure
              le pourcentage de votes d&apos;un parlementaire alignés avec la position majoritaire
              de son groupe.
            </p>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Comment c&apos;est calculé</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Pour chaque scrutin, CLAIR identifie la position majoritaire du groupe (la position
                choisie par le plus grand nombre de membres). Un parlementaire qui vote dans ce sens
                est considéré comme &laquo; loyal &raquo;. Le taux de loyauté est le pourcentage de
                votes loyaux sur l&apos;ensemble des scrutins auxquels le parlementaire a participé.
              </p>
            </div>
            <p>
              Un taux de loyauté élevé indique une forte discipline de vote. Un taux plus bas peut
              refléter un positionnement indépendant ou des désaccords internes au groupe.
            </p>
          </div>
        </section>

        {/* Majorité et opposition */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Majorité et opposition</h2>
          <div className="mt-4 space-y-3 text-muted-foreground">
            <p>
              Le <strong className="text-foreground">groupe majoritaire</strong> (ou coalition
              majoritaire) soutient le gouvernement. Il dispose de la majorité des sièges et peut
              faire adopter les textes de loi.
            </p>
            <p>
              Les <strong className="text-foreground">groupes d&apos;opposition</strong> s&apos;opposent
              au gouvernement. Ils disposent de droits spécifiques : présidence de la commission des
              finances, &laquo; niche parlementaire &raquo; (journée dédiée à leurs propositions de loi).
            </p>
            <p>
              Les <strong className="text-foreground">groupes minoritaires</strong> ne se déclarent ni
              dans la majorité ni dans l&apos;opposition. Leur positionnement varie selon les textes.
            </p>
          </div>
        </section>

        {/* CTA */}
        <div className="mt-12">
          <Link
            href="/groupes"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Explorer les groupes politiques
          </Link>
        </div>
      </div>
    </div>
  );
}
