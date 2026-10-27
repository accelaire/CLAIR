/** Contenu de la page « API ouverte » (repris de apps/web/app/api/page.tsx). */
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Briefcase,
  Folders,
  Landmark,
  Search,
  Users,
  Vote,
} from "lucide-react";

export const DOCS_URL = "https://docs.clair.vote";

/**
 * Adresse publique de l'API, telle qu'on la montre aux lecteurs (exemples, liens « en direct »).
 * Ce n'est pas l'adresse que le site appelle.
 */
export const PUBLIC_API_URL = "https://api.clair.vote";

export const DATAGOUV_URL =
  "https://www.data.gouv.fr/dataservices/api-clair-transparence-politique";

export const GITHUB_URL = "https://github.com/accelaire/CLAIR";

export type Endpoint = {
  icon: LucideIcon;
  title: string;
  description: string;
  path: string;
  example: string;
};

export const endpoints: readonly Endpoint[] = [
  {
    icon: Landmark,
    title: "Députés",
    description: "Fiche, groupe, votes, présence, loyauté, activité de chaque député",
    path: "/api/v1/deputes",
    example: "/api/v1/deputes?limit=10",
  },
  {
    icon: Landmark,
    title: "Sénateurs",
    description: "Données complètes sur les sénateurs : groupe, commission, votes",
    path: "/api/v1/senateurs",
    example: "/api/v1/senateurs?limit=10",
  },
  {
    icon: Users,
    title: "Groupes politiques",
    description: "Composition, effectifs et votes de chaque groupe parlementaire",
    path: "/api/v1/groupes",
    example: "/api/v1/groupes",
  },
  {
    icon: Vote,
    title: "Scrutins",
    description: "Tous les votes de l'Assemblée et du Sénat, avec le détail par parlementaire",
    path: "/api/v1/scrutins",
    example: "/api/v1/scrutins?limit=5",
  },
  {
    icon: Briefcase,
    title: "Lobbying",
    description: "Représentants d'intérêts et leurs actions (données HATVP)",
    path: "/api/v1/lobbying",
    example: "/api/v1/lobbying?limit=10",
  },
  {
    icon: Folders,
    title: "Dossiers législatifs",
    description: "Textes de loi, leur parcours parlementaire et les scrutins associés",
    path: "/api/v1/dossiers",
    example: "/api/v1/dossiers?limit=5",
  },
  {
    icon: BookOpen,
    title: "Sujets",
    description: "Thématiques parlementaires et les dossiers qui s'y rapportent",
    path: "/api/v1/sujets",
    example: "/api/v1/sujets",
  },
  {
    icon: Search,
    title: "Recherche",
    description: "Recherche sur les parlementaires, scrutins, dossiers, groupes et lobbyistes",
    path: "/api/v1/search",
    example: "/api/v1/search?q=retraites",
  },
  {
    icon: BarChart3,
    title: "Statistiques",
    description: "Chiffres clés et statistiques agrégées de l'activité parlementaire",
    path: "/api/v1/analytics",
    example: "/api/v1/analytics/stats",
  },
];

export const curlExample = `# Récupérer les 5 derniers scrutins
curl "${PUBLIC_API_URL}/api/v1/scrutins?limit=5"

# Chercher un député
curl "${PUBLIC_API_URL}/api/v1/deputes?search=dupont"

# Détail d'un scrutin avec les votes individuels
curl "${PUBLIC_API_URL}/api/v1/scrutins/{id}"

# Données lobbying
curl "${PUBLIC_API_URL}/api/v1/lobbying?limit=10"`;

export const usageTerms = [
  "Accès libre, sans authentification",
  "Rate limiting raisonnable pour garantir la disponibilité",
  "Données issues de sources publiques officielles",
  "Merci de citer CLAIR si vous réutilisez les données",
] as const;

export const dataSources = [
  { name: "Assemblée nationale", text: "députés, scrutins, amendements, interventions" },
  { name: "Sénat", text: "sénateurs, scrutins, dossiers législatifs" },
  { name: "HATVP", text: "représentants d'intérêts et actions de lobbying" },
  { name: "DILA", text: "comptes rendus intégraux des débats" },
] as const;
