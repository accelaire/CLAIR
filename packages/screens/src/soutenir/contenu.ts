/** Contenu de la page « Soutenir » (repris de apps/web/app/soutenir/page.tsx). */
import type { FaqItem } from "@clair/ui";
import type { LucideIcon } from "lucide-react";
import {
  Coins,
  Landmark,
  Mail,
  MessageCircle,
  Receipt,
  Repeat,
  Server,
  ShieldCheck,
  Vote,
} from "lucide-react";

export const HELLOASSO_URL =
  "https://www.helloasso.com/associations/clair-citoyen-libre-analyse-information-republique/formulaires/1";
export const HELLOASSO_WIDGET_URL = `${HELLOASSO_URL}/widget`;
export const GITHUB_URL = "https://github.com/accelaire/CLAIR";
export const DISCORD_URL = "https://discord.gg/pxHV4rNWck";
export const ROADMAP_URL = "https://github.com/accelaire/CLAIR/discussions/93";
export const CONTACT_EMAIL = "contact@clair.vote";

/**
 * Chiffres de la page d'accueil de l'API (`GET /homepage`, champ `stats`) affichés ici.
 * Seuls les champs utilisés par la page sont décrits.
 */
export type SoutenirStats = {
  scrutins: number;
  amendements: number;
  interventions: number;
  actionsLobby: number;
};

export const figures: readonly { key: keyof SoutenirStats; label: string }[] = [
  { key: "scrutins", label: "scrutins analysés" },
  { key: "amendements", label: "amendements" },
  { key: "interventions", label: "prises de parole" },
  { key: "actionsLobby", label: "actions de lobbying" },
];

export const uses: readonly { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Server,
    title: "Faire tourner CLAIR",
    text: "Les serveurs, la base de données, la mise à jour de chaque nuit et l'API ouverte gratuitement aux journalistes, chercheurs et associations.",
  },
  {
    icon: Landmark,
    title: "Suivre le gouvernement",
    text: "Les ministres, les 49.3, les motions de censure : c'est notre prochain chantier.",
  },
  {
    icon: Vote,
    title: "Éclairer la présidentielle",
    text: "Le bilan vérifiable du quinquennat, avant le premier tour du 18 avril 2027.",
  },
];

export const guarantees: readonly { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Receipt,
    title: "66 % déductible de vos impôts",
    text: "Un don de 30\u00a0€ ne vous coûte que 10,20\u00a0€. HelloAsso vous envoie le reçu fiscal automatiquement.",
  },
  {
    icon: Repeat,
    title: "Ponctuel ou mensuel",
    text: "Un don mensuel, même petit, nous permet de prévoir.",
  },
  {
    icon: ShieldCheck,
    title: "Paiement sécurisé par HelloAsso",
    text: "La plateforme de paiement utilisée par les associations françaises.",
  },
  {
    icon: Coins,
    title: "Zéro frais sur votre don",
    text: "HelloAsso vous proposera une contribution facultative à son propre fonctionnement : vous pouvez la mettre à 0\u00a0€.",
  },
];

export type HelpTrack = {
  id: "github" | "discord" | "email";
  icon?: LucideIcon;
  title: string;
  text: string;
  href: string;
  label: string;
};

export const helpTracks: readonly HelpTrack[] = [
  {
    id: "github",
    title: "Contribuez au code",
    text: "Le projet est open source : code, données, documentation, toute aide compte.",
    href: GITHUB_URL,
    label: "Voir sur GitHub",
  },
  {
    id: "discord",
    icon: MessageCircle,
    title: "Rejoignez la communauté",
    text: "Discutez des prochaines fonctionnalités et des données avec l'équipe.",
    href: DISCORD_URL,
    label: "Rejoindre le Discord",
  },
  {
    id: "email",
    icon: Mail,
    title: "Signalez une erreur",
    text: "Une donnée fausse, une page qui coince ? Vos retours font progresser CLAIR.",
    href: `mailto:${CONTACT_EMAIL}`,
    label: "Nous écrire",
  },
];

export const team = [
  {
    name: "Axel",
    photo: "/images/axel.jpg",
    alt: "Axel, créateur de CLAIR",
    role: "Ingénieur et passionné de data",
    quote:
      "J'ai créé CLAIR pour donner vie aux données publiques et rendre la vie politique française claire et accessible à tous.",
    linkedin: "https://www.linkedin.com/in/axel-robaldo-ensea/",
  },
  {
    name: "Ruben",
    photo: "/images/ruben.jpg",
    alt: "Ruben, ingénieur-chercheur en IA",
    role: "Ingénieur-chercheur en IA",
    quote:
      "J'ai rejoint CLAIR pour aider nos institutions dans leur devoir de transparence à notre égard. Je souhaite proposer une plateforme neutre et intuitive comme support au débat entre citoyens.",
    linkedin: "https://www.linkedin.com/in/rubenwleon/",
  },
  {
    name: "Paul",
    photo: "/images/paul.jpg",
    alt: "Paul, contributeur CLAIR",
    role: "Designer UX/UI",
    quote:
      "Avec CLAIR, je souhaite rendre la politique institutionnelle lisible au plus grand nombre.",
    linkedin: "https://www.linkedin.com/in/paul-albagli",
  },
] as const;

export const faq: FaqItem[] = [
  {
    question: "Les dons sont-ils déductibles des impôts ?",
    answer:
      "Oui. CLAIR est une association d'intérêt général à caractère éducatif, ce que l'administration fiscale a confirmé par un rescrit en février 2026. Votre don est déductible à 66 % de votre impôt sur le revenu, dans la limite de 20 % de votre revenu imposable. HelloAsso vous envoie le reçu fiscal automatiquement.",
  },
  {
    question: "À quoi servent les dons ?",
    answer:
      "À payer ce qui fait tourner CLAIR : les serveurs, la base de données, la mise à jour de chaque nuit et l'API ouverte à tous. L'équipe est entièrement bénévole : aucun don ne sert à rémunérer qui que ce soit.",
  },
  {
    question: "CLAIR est-il vraiment indépendant ?",
    answer:
      "Oui. CLAIR ne reçoit aucun argent de partis politiques, d'entreprises ou de lobbies. L'association vit des cotisations de ses membres et de vos dons. Le code est open source : chacun peut vérifier ce que nous faisons.",
  },
  {
    question: "Comment faire un don ?",
    answer:
      "Directement sur cette page, avec le formulaire HelloAsso, en don ponctuel ou mensuel. HelloAsso ne prélève aucun frais sur votre don. Il vous propose une contribution facultative à son propre fonctionnement, que vous pouvez mettre à 0 €.",
  },
];
