import type { Meta, StoryObj } from "@storybook/react-vite";
import { EvenementCard } from "./EvenementCard.tsx";

const meta = {
  title: "Composants/Parlementaire/EvenementCard",
  component: EvenementCard,
  args: {
    title: "Commission des finances",
    type: "commission",
    chambre: "assemblee",
    start: "2026-03-03T09:30:00+01:00",
    end: "2026-03-03T12:00:00+01:00",
    description: "Audition d'exemple sur l'exécution du budget.",
    lieu: "Salle d'exemple",
    href: "#reunion",
  },
  argTypes: {
    title: { description: "Titre de l'événement.", table: { category: "Contenu" } },
    type: {
      description: "Type d'événement, annoncé par un libellé et une icône.",
      control: { type: "select" },
      options: [
        "seance",
        "commission",
        "reunion",
        "election",
        "session",
        "suspension",
        "budget",
        "institution",
      ],
      table: { category: "Contenu" },
    },
    chambre: {
      description: "Chambre concernée.",
      control: { type: "inline-radio", labels: { assemblee: "Assemblée", senat: "Sénat" } },
      options: ["assemblee", "senat"],
      table: { category: "Contenu" },
    },
    start: { description: "Début (ISO, date ou date et heure).", table: { category: "Date" } },
    end: { description: "Fin (ISO).", table: { category: "Date" } },
    datePrecise: {
      description: "Date fixée officiellement ; sinon seul le mois est affiché.",
      control: "boolean",
      table: { category: "Date" },
    },
    live: {
      description: "L'événement a lieu maintenant (calculé par l'application).",
      control: "boolean",
      table: { category: "État" },
    },
    liveHref: { description: "Retransmission en direct.", table: { category: "État" } },
    href: { description: "Page de l'événement.", table: { category: "Contenu" } },
    lieu: { description: "Lieu.", table: { category: "Contenu" } },
    description: { description: "Ordre du jour.", table: { category: "Contenu" } },
    sources: { description: "Sources officielles.", table: { category: "Contenu" } },
    titleAs: { description: "Niveau du titre.", table: { category: "Structure" } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Événement de l'agenda : date et heure de Paris, chambre, type, titre et lien ; « En direct » en texte pendant l'événement. Fusionne `EvenementCard` et `ReunionCard` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof EvenementCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const EnDirect: Story = {
  args: {
    title: "Séance publique",
    type: "seance",
    chambre: "senat",
    start: "2026-03-03T14:30:00+01:00",
    end: null,
    description: "Suite de l'examen d'un projet de loi d'exemple.",
    lieu: null,
    live: true,
    liveHref: "https://videos.senat.fr",
  },
};

export const Echeance: Story = {
  args: {
    title: "Élections sénatoriales",
    type: "election",
    chambre: "senat",
    start: "2026-09-01",
    end: null,
    datePrecise: false,
    description: "Renouvellement d'une série du Sénat.",
    lieu: null,
    href: undefined,
    sources: [{ label: "Sénat", href: "https://www.senat.fr" }],
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { ...EnDirect, globals: { theme: "dark" } };
