import type { Metadata } from 'next';
import Link from 'next/link';
import { User, TrendingUp, Users, Vote, MessageSquare } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Le parlementaire | CLAIR',
  description:
    'Comprendre le rôle d\u2019un parlementaire : mandat, élection, statistiques de présence, loyauté et participation.',
};

const stats = [
  {
    icon: TrendingUp,
    title: 'Présence solennelle',
    description:
      'Pourcentage de scrutins solennels auxquels le parlementaire a participé (voté pour, contre ou abstention). Les scrutins solennels portent sur l\u2019ensemble d\u2019un texte de loi et sont les plus importants.',
  },
  {
    icon: Users,
    title: 'Loyauté au groupe',
    description:
      'Pourcentage de votes alignés avec la position majoritaire du groupe politique. Si le groupe vote majoritairement « pour » et que le parlementaire vote « pour », c\u2019est un vote loyal.',
  },
  {
    icon: Vote,
    title: 'Participation',
    description:
      'Nombre total de scrutins publics auxquels le parlementaire a pris part (voté pour, contre ou abstention).',
  },
  {
    icon: MessageSquare,
    title: 'Interventions',
    description:
      'Nombre de prises de parole en séance publique : questions au gouvernement, interventions dans les débats, explications de vote.',
  },
];

export default function ParlementairePage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
          <User className="h-8 w-8 text-primary" />
          Le parlementaire
        </h1>

        {/* Mandat */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Le mandat</h2>
          <div className="mt-4 space-y-3 text-muted-foreground">
            <p>
              <strong className="text-foreground">Élection des députés</strong> : au scrutin uninominal
              majoritaire à deux tours, dans chacune des 577 circonscriptions. Mandat de 5 ans.
            </p>
            <p>
              <strong className="text-foreground">Élection des sénateurs</strong> : au suffrage universel
              indirect par un collège de grands électeurs (élus locaux). Mandat de 6 ans, renouvelé par moitié
              tous les 3 ans.
            </p>
            <p>
              <strong className="text-foreground">Circonscription</strong> : chaque parlementaire représente
              un territoire géographique précis. C&apos;est son ancrage local.
            </p>
            <p>
              <strong className="text-foreground">Immunité parlementaire</strong> : protection contre les
              poursuites judiciaires pour les actes liés à l&apos;exercice du mandat (irresponsabilité)
              et encadrement des arrestations (inviolabilité).
            </p>
          </div>
        </section>

        {/* Rôle */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Le rôle</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Voter la loi</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Participer aux scrutins publics pour adopter ou rejeter les textes de loi.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Contrôler le gouvernement</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Poser des questions, créer des commissions d&apos;enquête, voter la censure.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Proposer des textes</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Déposer des propositions de loi et des amendements pour modifier les textes.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Intervenir en séance</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Prendre la parole en séance publique pour défendre une position ou interpeller.
              </p>
            </div>
          </div>
        </section>

        {/* Stats CLAIR */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Les statistiques sur CLAIR</h2>
          <p className="mt-4 text-muted-foreground">
            Sur chaque fiche parlementaire, CLAIR affiche quatre indicateurs clés calculés à partir
            des données publiques.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.title} className="rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">{stat.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{stat.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Groupe vs Parti */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Groupe parlementaire vs parti politique</h2>
          <div className="mt-4 space-y-3 text-muted-foreground">
            <p>
              Le <strong className="text-foreground">groupe parlementaire</strong> est une structure
              interne à la chambre : il organise le travail des élus, répartit le temps de parole et
              siège dans les commissions. Seuil minimum : 15 députés à l&apos;AN, 10 sénateurs au Sénat.
            </p>
            <p>
              Le <strong className="text-foreground">parti politique</strong> est une organisation
              extérieure au Parlement. Un même parti peut avoir des élus dans plusieurs groupes, et un
              groupe peut rassembler des élus de plusieurs partis.
            </p>
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
