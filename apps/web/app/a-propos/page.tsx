import type { Metadata } from 'next';
import Link from 'next/link';
import { Users, Vote, Briefcase, Database, Github, Twitter, Mail } from 'lucide-react';

export const metadata: Metadata = {
  title: 'À propos',
  description: 'CLAIR est une plateforme citoyenne de transparence politique. Découvrez notre mission, nos valeurs et comment nous rendons la politique française plus accessible.',
};

export default function AProposPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero */}
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Rendre la politique <span className="text-primary">lisible</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground">
          CLAIR (Citoyen Libre, Analyse, Information, République) est une plateforme
          indépendante qui agrège et présente les données publiques de la vie politique
          française. Pas d&apos;opinion, que des faits.
        </p>
      </div>

      {/* Mission */}
      <div className="mx-auto mt-16 max-w-4xl">
        <h2 className="text-2xl font-bold">Notre mission</h2>
        <div className="mt-6 space-y-4 text-muted-foreground">
          <p>
            La transparence politique est un pilier de la démocratie. Pourtant, les données
            sur l&apos;activité de nos élus sont dispersées, difficiles d&apos;accès et
            souvent incompréhensibles pour le citoyen lambda.
          </p>
          <p>
            CLAIR rassemble ces informations publiques en un seul endroit, les structure,
            et les présente de manière claire et accessible. Notre objectif : permettre à
            chaque citoyen de comprendre ce que font ses représentants, comment ils votent,
            et qui cherche à les influencer.
          </p>
          <p>
            Nous ne portons aucun jugement politique. Nous présentons les faits tels qu&apos;ils
            sont publiés par les institutions : Assemblée nationale, Sénat, Haute Autorité
            pour la Transparence de la Vie Publique (HATVP), et Direction de l&apos;Information
            Légale et Administrative (DILA). D'autres sources officielles viendront s'ajouter
            au fur et à mesure de l'avancée du projet.
          </p>
        </div>
      </div>

      {/* Ce que nous proposons */}
      <div className="mx-auto mt-16 max-w-4xl">
        <h2 className="text-2xl font-bold">Ce que nous proposons</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Fiches parlementaires et groupes</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Profils détaillés des 575 députés et 348 sénateurs de la 17ème législature ainsi que leurs groupes: votes, interventions,
                  amendements, présence, et relations avec les lobbyistes.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <Vote className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Scrutins publics</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Tous les scrutins publics avec le détail des votes par parlementaire
                  et par groupe politique. Filtrez par thème, date ou résultat.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <Briefcase className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Activités de lobbying</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Données du répertoire des représentants d&apos;intérêts (HATVP):
                  qui sont les lobbyistes, quelles actions mènent-ils, auprès de qui.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Données structurées</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Toutes les données sont synchronisées quotidiennement depuis les
                  sources officielles et structurées pour faciliter l&apos;analyse.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Valeurs */}
      <div className="mx-auto mt-16 max-w-4xl">
        <h2 className="text-2xl font-bold">Nos valeurs</h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-3">
          <div>
            <h3 className="font-semibold">Neutralité</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Aucune opinion politique. Nous présentons les données telles qu&apos;elles
              sont, sans commentaire ni orientation.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Transparence</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Notre code est open source. Chacun peut vérifier comment nous traitons
              les données et contribuer au projet.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Accessibilité</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              L&apos;information politique doit être accessible à tous, sans jargon
              technique ni barrière à l&apos;entrée.
            </p>
          </div>
        </div>
      </div>

      {/* Open Source */}
      <div className="mx-auto mt-16 max-w-4xl rounded-xl bg-muted/50 p-8">
        <h2 className="text-2xl font-bold">Projet open source</h2>
        <p className="mt-4 text-muted-foreground">
          CLAIR est un projet open source. Le code est disponible sur GitHub et les
          contributions sont les bienvenues. Que vous soyez développeur, designer,
          data analyst ou simplement citoyen engagé, vous pouvez participer.
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <a
            href="https://github.com/accelaire/CLAIR"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Github className="mr-2 h-4 w-4" />
            Voir sur GitHub
          </a>
          <Link
            href="/methodologie"
            className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            En savoir plus sur la méthodologie
          </Link>
        </div>
      </div>

      {/* Contact */}
      <div className="mx-auto mt-16 max-w-4xl text-center">
        <h2 className="text-2xl font-bold">Nous contacter</h2>
        <p className="mt-4 text-muted-foreground">
          Une question, une suggestion, une erreur à signaler ?
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <Link
            href="/contact"
            className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            <Mail className="mr-2 h-4 w-4" />
            Contact
          </Link>
        </div>
      </div>
    </div>
  );
}
