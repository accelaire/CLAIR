import type { Metadata } from 'next';
import { Database, RefreshCw, Server, FileJson, ExternalLink } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Méthodologie',
  description: 'Découvrez comment CLAIR collecte, structure et présente les données publiques de la vie politique française.',
};

export default function MethodologiePage() {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight">Méthodologie</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          CLAIR agrège des données publiques provenant de sources officielles.
          Cette page explique comment nous collectons, structurons et présentons
          ces informations.
        </p>
      </div>

      {/* Sources de données */}
      <div className="mx-auto mt-12 max-w-4xl">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <Database className="h-6 w-6" />
          Sources de données
        </h2>
        <p className="mt-4 text-muted-foreground">
          Toutes nos données proviennent de sources officielles et publiques.
          Aucune donnée n&apos;est inventée ou estimée.
        </p>

        <div className="mt-8 grid gap-6">
          {/* Assemblée nationale */}
          <div className="rounded-lg border bg-card">
            <div className="border-b p-4">
              <h3 className="flex items-center gap-2 font-semibold">
                Assemblée nationale - Open Data
                <a
                  href="https://data.assemblee-nationale.fr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </h3>
            </div>
            <div className="space-y-3 p-4 text-sm text-muted-foreground">
              <p>
                Le portail Open Data de l&apos;Assemblée nationale fournit des exports JSON
                complets de l&apos;activité parlementaire.
              </p>
              <div>
                <p className="font-medium text-foreground">Données collectées :</p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  <li><strong>Députés</strong> : identité, groupe politique, circonscription, mandats</li>
                  <li><strong>Scrutins publics</strong> : votes solennels et ordinaires avec résultats détaillés</li>
                  <li><strong>Votes individuels</strong> : position de chaque député sur chaque scrutin (pour, contre, abstention, absent)</li>
                  <li><strong>Amendements</strong> : texte, auteur, sort (adopté, rejeté, retiré)</li>
                  <li><strong>Dossiers législatifs</strong> : projets et propositions de loi, procédure</li>
                </ul>
              </div>
              <p>
                <span className="font-medium text-foreground">Format :</span> Archives ZIP contenant des fichiers JSON
              </p>
            </div>
          </div>

          {/* Sénat */}
          <div className="rounded-lg border bg-card">
            <div className="border-b p-4">
              <h3 className="flex items-center gap-2 font-semibold">
                Sénat - Open Data
                <a
                  href="https://data.senat.fr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </h3>
            </div>
            <div className="space-y-3 p-4 text-sm text-muted-foreground">
              <p>
                Le Sénat publie également ses données en open data via son portail dédié.
              </p>
              <div>
                <p className="font-medium text-foreground">Données collectées :</p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  <li><strong>Sénateurs</strong> : identité, groupe politique, circonscription, série</li>
                  <li><strong>Scrutins publics</strong> : votes avec résultats par groupe</li>
                  <li><strong>Votes individuels</strong> : position de chaque sénateur</li>
                  <li><strong>Amendements</strong> : propositions de modification des textes</li>
                  <li><strong>Interventions</strong> : prises de parole en séance</li>
                </ul>
              </div>
            </div>
          </div>

          {/* DILA */}
          <div className="rounded-lg border bg-card">
            <div className="border-b p-4">
              <h3 className="flex items-center gap-2 font-semibold">
                DILA - Comptes rendus des débats
                <a
                  href="https://echanges.dila.gouv.fr/OPENDATA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </h3>
            </div>
            <div className="space-y-3 p-4 text-sm text-muted-foreground">
              <p>
                La Direction de l&apos;Information Légale et Administrative publie les comptes
                rendus intégraux des débats parlementaires.
              </p>
              <div>
                <p className="font-medium text-foreground">Données collectées :</p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  <li><strong>Interventions</strong> : texte intégral des prises de parole en séance</li>
                  <li><strong>Questions au Gouvernement</strong> : questions orales et réponses</li>
                  <li><strong>Explications de vote</strong> : justifications des positions</li>
                </ul>
              </div>
              <p>
                <span className="font-medium text-foreground">Format :</span> Archives TAR contenant des fichiers XML
              </p>
            </div>
          </div>

          {/* HATVP */}
          <div id="hatvp" className="rounded-lg border bg-card scroll-mt-20">
            <div className="border-b p-4">
              <h3 className="flex items-center gap-2 font-semibold">
                HATVP - Répertoire des représentants d&apos;intérêts
                <a
                  href="https://www.hatvp.fr/le-repertoire/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </h3>
            </div>
            <div className="space-y-3 p-4 text-sm text-muted-foreground">
              <p>
                La Haute Autorité pour la Transparence de la Vie Publique tient le registre
                obligatoire des lobbyistes en France.
              </p>
              <div>
                <p className="font-medium text-foreground">Données collectées :</p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  <li><strong>Représentants d&apos;intérêts</strong> : entreprises, associations, cabinets de conseil, syndicats</li>
                  <li><strong>Actions de lobbying</strong> : description des actions menées</li>
                  <li><strong>Cibles</strong> : parlementaires ou administrations contactés</li>
                  <li><strong>Budgets déclarés</strong> : moyens consacrés au lobbying</li>
                </ul>
              </div>
              <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-4 border border-amber-200 dark:border-amber-900">
                <p className="font-medium text-amber-800 dark:text-amber-400">Note sur le comptage</p>
                <p className="mt-2 text-amber-700 dark:text-amber-500">
                  Les chiffres affichés sur CLAIR peuvent différer de ceux du site HATVP. Cela s&apos;explique par notre méthodologie :
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-amber-700 dark:text-amber-500">
                  <li><strong>Actions par exercice</strong> : CLAIR compte chaque activité déclarée par exercice fiscal. Une activité identique déclarée sur 3 ans = 3 actions dans CLAIR.</li>
                  <li><strong>Historique complet</strong> : CLAIR conserve l&apos;historique depuis 2018, alors que HATVP peut n&apos;afficher que les données récentes ou agrégées.</li>
                  <li><strong>Entités distinctes</strong> : Les branches régionales d&apos;organisations (ex: Chambres de métiers départementales) sont comptées séparément si elles ont des identifiants HATVP distincts.</li>
                </ul>
                <p className="mt-2 text-amber-700 dark:text-amber-500">
                  Cette approche offre une <strong>transparence maximale</strong> sur l&apos;évolution du lobbying dans le temps.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline d'ingestion */}
      <div className="mx-auto mt-16 max-w-4xl">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <RefreshCw className="h-6 w-6" />
          Synchronisation des données
        </h2>
        <p className="mt-4 text-muted-foreground">
          Notre système d&apos;ingestion récupère et met à jour les données de manière
          automatique et régulière.
        </p>

        <div className="mt-8 space-y-6">
          <div className="rounded-lg border p-6">
            <h3 className="font-semibold">Processus de collecte</h3>
            <ol className="mt-4 list-inside list-decimal space-y-3 text-sm text-muted-foreground">
              <li>
                <strong>Vérification des mises à jour</strong> : Le système vérifie régulièrement
                si de nouvelles données sont disponibles sur les sources (via ETag ou date de modification).
              </li>
              <li>
                <strong>Téléchargement</strong> : Les nouvelles archives sont téléchargées et
                décompressées (ZIP pour l&apos;AN, TAR/XML pour la DILA).
              </li>
              <li>
                <strong>Transformation</strong> : Les données brutes sont transformées pour
                correspondre à notre modèle de données unifié.
              </li>
              <li>
                <strong>Stockage</strong> : Les données sont enregistrées dans notre base
                PostgreSQL avec traçabilité de la source.
              </li>
              <li>
                <strong>Indexation</strong> : Les données sont indexées dans Meilisearch
                pour permettre la recherche full-text.
              </li>
            </ol>
          </div>

          <div className="rounded-lg border p-6">
            <h3 className="font-semibold">Fréquence des mises à jour</h3>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>
                <strong>Scrutins et votes</strong> : Synchronisation quotidienne
              </li>
              <li>
                <strong>Parlementaires</strong> : Synchronisation quotidienne
              </li>
              <li>
                <strong>Interventions</strong> : Synchronisation quotidienne
              </li>
              <li>
                <strong>Amendements</strong> : Synchronisation quotidienne
              </li>
              <li>
                <strong>Lobbying (HATVP)</strong> : Synchronisation hebdomadaire
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Modèle de données */}
      <div className="mx-auto mt-16 max-w-4xl">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <FileJson className="h-6 w-6" />
          Modèle de données
        </h2>
        <p className="mt-4 text-muted-foreground">
          Les données sont structurées autour des entités principales suivantes :
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Parlementaire</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Député ou sénateur avec son identité, groupe politique, circonscription,
              et statistiques d&apos;activité (présence, loyauté au groupe, nombre
              d&apos;interventions et amendements).
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Groupe politique</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Groupe parlementaire à l&apos;Assemblée ou au Sénat, avec sa position
              sur l&apos;échiquier politique et la liste de ses membres.
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Scrutin</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Vote public avec date, titre, type (solennel, ordinaire, motion),
              résultat global et répartition des votes.
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Vote</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Position individuelle d&apos;un parlementaire sur un scrutin :
              pour, contre, abstention ou absent.
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Intervention</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Prise de parole en séance : question, intervention libre,
              ou explication de vote.
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Amendement</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Proposition de modification d&apos;un texte avec auteur,
              contenu et sort (adopté, rejeté, retiré).
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Lobbyiste</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Représentant d&apos;intérêts inscrit au répertoire HATVP :
              entreprise, association, cabinet de conseil, syndicat.
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Action de lobbying</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Action menée par un lobbyiste auprès d&apos;un parlementaire
              ou d&apos;une administration, avec dates et budget.
            </p>
          </div>
        </div>
      </div>

      {/* Stack technique */}
      <div className="mx-auto mt-16 max-w-4xl">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <Server className="h-6 w-6" />
          Stack technique
        </h2>
        <p className="mt-4 text-muted-foreground">
          CLAIR est construit avec des technologies modernes et open source :
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Frontend</h3>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>Next.js 14 (App Router)</li>
              <li>TypeScript</li>
              <li>Tailwind CSS</li>
              <li>TanStack Query</li>
            </ul>
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Backend</h3>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>Fastify</li>
              <li>Prisma ORM</li>
              <li>PostgreSQL</li>
              <li>Redis (cache & queues)</li>
            </ul>
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Ingestion</h3>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>BullMQ (jobs)</li>
              <li>Meilisearch (recherche)</li>
              <li>Connecteurs sources</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Limitations */}
      <div className="mx-auto mt-16 max-w-4xl rounded-xl bg-muted/50 p-8">
        <h2 className="text-2xl font-bold">Limitations et transparence</h2>
        <ul className="mt-6 space-y-4 text-muted-foreground">
          <li>
            <strong>Délai de publication</strong> : Les données ne sont disponibles sur CLAIR
            qu&apos;après leur publication par les sources officielles, généralement sous 24 à 48h.
          </li>
          <li>
            <strong>Scrutins non publics</strong> : Seuls les scrutins publics sont disponibles.
            Les votes en commission ou à main levée ne sont pas enregistrés nominativement.
          </li>
          <li>
            <strong>Données HATVP</strong> : Les informations de lobbying sont déclaratives.
            Leur exactitude dépend des déclarations des représentants d&apos;intérêts.
          </li>
          <li>
            <strong>Statistiques calculées</strong> : Les taux de présence et de loyauté sont
            calculés par nos soins à partir des données brutes. La méthodologie de calcul
            est documentée dans notre code source.
          </li>
        </ul>
      </div>
    </div>
  );
}
