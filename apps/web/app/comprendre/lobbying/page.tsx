import type { Metadata } from 'next';
import Link from 'next/link';
import { Briefcase, Building2, TrendingUp, Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Le lobbying en France',
  description:
    'Comprendre le lobbying en France : loi Sapin II, HATVP, déclarations et statistiques.',
};

const statsExplained = [
  {
    icon: TrendingUp,
    title: 'Budget déclaré',
    description:
      'Somme des budgets annuels déclarés par les représentants d\u2019intérêts. Ce sont des montants déclaratifs, souvent indiqués par tranches (ex : 100 000 - 200 000 €).',
  },
  {
    icon: Building2,
    title: 'Nombre de lobbyistes',
    description:
      'Nombre de représentants d\u2019intérêts enregistrés auprès de la HATVP : entreprises, associations, cabinets de conseil, syndicats, organisations professionnelles.',
  },
  {
    icon: Briefcase,
    title: 'Actions',
    description:
      'Chaque rencontre, communication ou démarche déclarée auprès d\u2019un décideur public. CLAIR compte chaque activité par exercice fiscal.',
  },
  {
    icon: Users,
    title: 'Secteurs',
    description:
      'Les domaines d\u2019activité déclarés par les représentants d\u2019intérêts : énergie, santé, numérique, agriculture, etc.',
  },
];

export default function LobbyingComprendrePage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
          <Briefcase className="h-8 w-8 text-primary" />
          Le lobbying en France
        </h1>

        {/* Contexte */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Cadre légal</h2>
          <div className="mt-4 space-y-3 text-muted-foreground">
            <p>
              Depuis la <strong className="text-foreground">loi Sapin II (2016)</strong>, les
              représentants d&apos;intérêts (lobbyistes) doivent s&apos;inscrire sur un registre
              tenu par la <strong className="text-foreground">HATVP</strong> (Haute Autorité pour
              la Transparence de la Vie Publique).
            </p>
            <p>
              Cette obligation de transparence concerne toute personne morale ou physique qui
              entre en contact avec un décideur public (parlementaire, ministre, haut fonctionnaire)
              pour influencer une décision publique.
            </p>
          </div>
        </section>

        {/* Ce qui est déclaré */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Ce qui est déclaré</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Actions de lobbying</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Chaque rencontre ou communication avec un décideur public doit être déclarée :
                objet de l&apos;action, cible contactée, texte visé.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Cibles</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Qui a été contacté : parlementaires, ministres, conseillers, administration.
                CLAIR relie ces actions aux fiches des élus concernés.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Budgets</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Le budget annuel consacré aux activités de lobbying, déclaré par tranches.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Identité</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Nom, type d&apos;organisation (entreprise, association, syndicat...), secteur
                d&apos;activité, nombre de lobbyistes employés.
              </p>
            </div>
          </div>
        </section>

        {/* Stats CLAIR */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Les statistiques sur CLAIR</h2>
          <p className="mt-4 text-muted-foreground">
            Sur la page Lobbying, CLAIR affiche quatre indicateurs clés calculés à partir des
            données du registre HATVP.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {statsExplained.map((stat) => {
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

        {/* CTA */}
        <div className="mt-12">
          <Link
            href="/lobbying"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Explorer le lobbying
          </Link>
        </div>
      </div>
    </div>
  );
}
