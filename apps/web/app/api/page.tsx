import type { Metadata } from 'next';
import Link from 'next/link';
import { Database, Code, ExternalLink, Landmark, Users, Vote, Briefcase, BookOpen, FileText, Search, BarChart3, Folders } from 'lucide-react';

export const metadata: Metadata = {
  title: 'API ouverte',
  description: 'Accédez librement aux données politiques françaises via l\'API CLAIR : députés, sénateurs, scrutins, lobbying, dossiers législatifs. Données ouvertes, documentées et gratuites.',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const endpoints = [
  {
    icon: Landmark,
    title: 'Députés',
    description: 'Fiche, groupe, votes, présence, loyauté, activité de chaque député',
    path: '/api/v1/deputes',
    example: '/api/v1/deputes?limit=10',
  },
  {
    icon: Landmark,
    title: 'Sénateurs',
    description: 'Données complètes sur les sénateurs : groupe, commission, votes',
    path: '/api/v1/senateurs',
    example: '/api/v1/senateurs?limit=10',
  },
  {
    icon: Users,
    title: 'Groupes politiques',
    description: 'Composition, effectifs et votes de chaque groupe parlementaire',
    path: '/api/v1/groupes',
    example: '/api/v1/groupes',
  },
  {
    icon: Vote,
    title: 'Scrutins',
    description: 'Tous les votes de l\'Assemblée et du Sénat, avec le détail par parlementaire',
    path: '/api/v1/scrutins',
    example: '/api/v1/scrutins?limit=5&sort=date',
  },
  {
    icon: Briefcase,
    title: 'Lobbying',
    description: 'Représentants d\'intérêts et leurs actions (données HATVP)',
    path: '/api/v1/lobbying',
    example: '/api/v1/lobbying?limit=10',
  },
  {
    icon: Folders,
    title: 'Dossiers législatifs',
    description: 'Textes de loi, leur parcours parlementaire et les scrutins associés',
    path: '/api/v1/dossiers',
    example: '/api/v1/dossiers?limit=5',
  },
  {
    icon: BookOpen,
    title: 'Sujets',
    description: 'Thématiques parlementaires et les dossiers qui s\'y rapportent',
    path: '/api/v1/sujets',
    example: '/api/v1/sujets',
  },
  {
    icon: Search,
    title: 'Recherche',
    description: 'Recherche plein texte sur l\'ensemble des données (Meilisearch)',
    path: '/api/v1/search',
    example: '/api/v1/search?q=retraites',
  },
  {
    icon: BarChart3,
    title: 'Statistiques',
    description: 'Chiffres clés et statistiques agrégées de l\'activité parlementaire',
    path: '/api/v1/analytics',
    example: '/api/v1/analytics/explorer',
  },
];

const curlExample = `# Récupérer les 5 derniers scrutins
curl "${API_URL}/api/v1/scrutins?limit=5&sort=date"

# Chercher un député
curl "${API_URL}/api/v1/deputes?search=dupont"

# Détail d'un scrutin avec les votes individuels
curl "${API_URL}/api/v1/scrutins/{id}"

# Données lobbying
curl "${API_URL}/api/v1/lobbying?limit=10"`;

export default function ApiPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="py-16 px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Database className="h-4 w-4" />
            Données ouvertes &amp; gratuites
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            L&apos;API ouverte <span className="text-primary">CLAIR</span>
          </h1>

          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Accédez librement aux données politiques françaises. Députés, sénateurs,
            scrutins, lobbying, dossiers législatifs. Tout est documenté, structuré et gratuit.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={`${API_URL}/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors"
            >
              <FileText className="h-5 w-5" />
              Documentation Swagger
              <ExternalLink className="h-4 w-4" />
            </a>
            <a
              href="https://www.data.gouv.fr/dataservices/api-clair-transparence-politique"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-border px-6 py-3 rounded-xl font-medium hover:bg-accent transition-colors"
            >
              <img src="/images/datagouv.svg" alt="" className="h-4" aria-hidden="true" />
              Voir sur data.gouv.fr
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Philosophie open data */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="rounded-2xl border bg-card p-8 md:p-10">
            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-4">Pourquoi une API ouverte ?</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    Les données politiques sont publiques par nature. Elles proviennent de
                    l&apos;Assemblée nationale, du Sénat, de la HATVP et de la DILA.
                    CLAIR les agrège, les structure et les enrichit pour les rendre
                    réellement exploitables.
                  </p>
                  <p>
                    Notre API est <strong className="text-foreground">gratuite, sans authentification</strong> et
                    sans limite abusive. Que vous soyez journaliste, chercheur, développeur
                    ou citoyen curieux, ces données vous appartiennent.
                  </p>
                  <p>
                    CLAIR est désormais référencé sur <strong className="text-foreground">data.gouv.fr</strong>,
                    la plateforme ouverte des données publiques françaises.
                  </p>
                </div>
              </div>
              <div className="md:w-64 flex-shrink-0 flex flex-col gap-4">
                <div className="rounded-xl bg-muted/50 p-4 text-center">
                  <p className="text-3xl font-bold text-primary">9</p>
                  <p className="text-sm text-muted-foreground">endpoints principaux</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-4 text-center">
                  <p className="text-3xl font-bold text-primary">4</p>
                  <p className="text-sm text-muted-foreground">sources officielles</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-4 text-center">
                  <p className="text-3xl font-bold text-primary">0&thinsp;&euro;</p>
                  <p className="text-sm text-muted-foreground">gratuit, sans clé API</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Endpoints */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Ce que vous pouvez récupérer
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Chaque ressource est paginée, filtrable et documentée.
              Cliquez pour voir l&apos;exemple en direct.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {endpoints.map((ep) => (
              <a
                key={ep.path}
                href={`${API_URL}${ep.example}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border bg-card p-5 hover:border-primary/50 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 flex-shrink-0">
                    <ep.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold group-hover:text-primary transition-colors">
                      {ep.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">{ep.description}</p>
                    <code className="text-xs text-primary/70 mt-2 block truncate">
                      {ep.path}
                    </code>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Exemples de code */}
      <section className="py-12 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Prêt en une ligne
            </h2>
            <p className="text-muted-foreground">
              Pas de clé API, pas d&apos;inscription. Un simple <code className="bg-muted px-1.5 py-0.5 rounded text-sm">curl</code> suffit.
            </p>
          </div>

          <div className="rounded-2xl border bg-zinc-950 p-6 overflow-x-auto">
            <div className="flex items-center gap-2 mb-4">
              <Code className="h-4 w-4 text-zinc-400" />
              <span className="text-xs text-zinc-400 font-mono">Terminal</span>
            </div>
            <pre className="text-sm text-zinc-100 font-mono whitespace-pre leading-relaxed">
              {curlExample}
            </pre>
          </div>

          <p className="text-sm text-muted-foreground mt-4 text-center">
            Les réponses sont en JSON. Pagination via <code className="bg-muted px-1 py-0.5 rounded text-xs">limit</code> et <code className="bg-muted px-1 py-0.5 rounded text-xs">offset</code>.
            Consultez la{' '}
            <a
              href={`${API_URL}/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              documentation Swagger
            </a>
            {' '}pour le détail de chaque endpoint.
          </p>
        </div>
      </section>

      {/* Utilisation & data.gouv */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-xl border bg-card p-6">
              <h3 className="font-semibold text-lg mb-3">Conditions d&apos;utilisation</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Accès libre, sans authentification</li>
                <li>Rate limiting raisonnable pour garantir la disponibilité</li>
                <li>Données issues de sources publiques officielles</li>
                <li>Merci de citer CLAIR si vous réutilisez les données</li>
                <li>
                  <a
                    href="https://github.com/accelaire/CLAIR"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Code source ouvert sur GitHub
                  </a>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border bg-card p-6">
              <h3 className="font-semibold text-lg mb-3">Sources des données</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">Assemblée nationale</strong> : députés, scrutins, amendements, interventions
                </li>
                <li>
                  <strong className="text-foreground">Sénat</strong> : sénateurs, scrutins, dossiers législatifs
                </li>
                <li>
                  <strong className="text-foreground">HATVP</strong> : représentants d&apos;intérêts et actions de lobbying
                </li>
                <li>
                  <strong className="text-foreground">DILA</strong> : comptes rendus intégraux des débats
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="rounded-2xl bg-primary-deep p-8 md:p-12 text-white text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Construisons ensemble la transparence
            </h2>
            <p className="text-white/80 mb-8 max-w-xl mx-auto">
              Vous avez un projet qui utilise nos données ? Une idée d&apos;amélioration ?
              Contribuez au code ou contactez-nous.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={`${API_URL}/docs`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white/90 dark:bg-white px-6 py-3 rounded-xl font-medium text-gray-700 hover:bg-white transition-colors"
              >
                <FileText className="h-5 w-5" />
                Explorer la documentation
              </a>
              <Link
                href="/soutenir"
                className="inline-flex items-center gap-2 border border-white/30 px-6 py-3 rounded-xl font-medium text-white hover:bg-white/10 transition-colors"
              >
                Soutenir CLAIR
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
