/** Contenu de la page « Contact » (repris de apps/web/app/contact/page.tsx). */

export const CONTACT_EMAIL = "contact@clair.vote";
export const GITHUB_URL = "https://github.com/accelaire/CLAIR";
export const CONTRIBUTION_GUIDE_URL =
  "https://docs.clair.vote/guide/guide-developpeur/contribution";

export type ContactChannel = {
  id: "email" | "x" | "bug" | "idee";
  title: string;
  subtitle: string;
  text: string;
  href: string;
  action: string;
  external: boolean;
};

export const channels: readonly ContactChannel[] = [
  {
    id: "email",
    title: "Email",
    subtitle: "Pour les questions générales",
    text: "Écrivez-nous pour toute question sur le projet, demande de partenariat, ou sujet ne rentrant pas dans les autres catégories.",
    href: `mailto:${CONTACT_EMAIL}`,
    action: CONTACT_EMAIL,
    external: false,
  },
  {
    id: "x",
    title: "X (Twitter)",
    subtitle: "Suivez l'actualité du projet",
    text: "Nous publions les mises à jour, les nouvelles fonctionnalités et des analyses ponctuelles sur notre compte X.",
    href: "https://x.com/ClairPolitique",
    action: "@ClairPolitique",
    external: true,
  },
  {
    id: "bug",
    title: "Signaler un bug",
    subtitle: "Via GitHub Issues (bug)",
    text: "Vous avez trouvé un bug ou une erreur dans les données ? Ouvrez une issue sur notre dépôt GitHub pour nous le signaler.",
    href: "https://github.com/accelaire/CLAIR/issues/new?labels=bug",
    action: "Ouvrir une issue",
    external: true,
  },
  {
    id: "idee",
    title: "Suggérer une fonctionnalité",
    subtitle: "Via GitHub Issues (feature request)",
    text: "Une idée d'amélioration ? Une fonctionnalité qui vous manque ? Proposez-la sur GitHub également.",
    href: "https://github.com/accelaire/CLAIR/issues/new?labels=feature-request",
    action: "Proposer une idée",
    external: true,
  },
];
