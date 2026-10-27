import type { Meta, StoryObj } from "@storybook/react-vite";
import { Share2 } from "lucide-react";
import { Badge } from "../../core/badge/Badge.tsx";
import { PageHeader } from "./PageHeader.tsx";

const meta = {
  title: "Composants/Mise en page/PageHeader",
  component: PageHeader,
  args: {
    title: "Scrutins",
    description:
      "Tous les votes publics de l'Assemblée nationale et du Sénat, avec le détail par groupe.",
  },
  argTypes: {
    title: { description: "Titre de la page (unique `h1`).", table: { category: "Contenu" } },
    description: { description: "Chapeau sous le titre.", table: { category: "Contenu" } },
    breadcrumb: {
      description: "Fil d'Ariane, de l'accueil à la page courante incluse.",
      table: { category: "Navigation" },
    },
    badges: {
      description: "Badges sous le titre.",
      control: false,
      table: { category: "Contenu" },
    },
    actions: {
      description: "Actions de la page, à droite sur grand écran.",
      control: false,
      table: { category: "Contenu" },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "En-tête de page : fil d'Ariane, unique `h1`, badges, chapeau et actions. Remplace les en-têtes écrits dans chaque `PageClient` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

const actionPartager = (
  <button
    type="button"
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--clair-espacement-2v)",
      padding: "var(--clair-espacement-2v) var(--clair-espacement-3v)",
      border: "var(--clair-trait-defaut)",
      borderRadius: "var(--clair-rayon-lg)",
      background: "var(--clair-fond-surface)",
      color: "var(--clair-texte-defaut)",
      font: "inherit",
    }}
  >
    <Share2 aria-hidden="true" size="1em" />
    Partager
  </button>
);

export const Defaut: Story = {};

export const AvecFilDAriane: Story = {
  args: {
    title: "Scrutin n° 1234",
    description: "Vote solennel sur l'ensemble d'un projet de loi fictif.",
    breadcrumb: [
      { label: "Accueil", href: "/" },
      { label: "Scrutins", href: "/scrutins" },
      { label: "Scrutin n° 1234" },
    ],
  },
};

export const AvecBadges: Story = {
  args: {
    title: "Camille Exemple",
    description: "Députée de la 3ᵉ circonscription d'un département fictif.",
    badges: (
      <>
        <Badge tone="info">Assemblée nationale</Badge>
        <Badge tone="succes">En exercice</Badge>
      </>
    ),
  },
};

export const AvecActions: Story = { args: { actions: actionPartager } };

export const Complet: Story = {
  args: {
    ...AvecFilDAriane.args,
    badges: <Badge tone="succes">Adopté</Badge>,
    actions: actionPartager,
  },
};

export const Mobile: Story = { ...Complet, globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { ...Complet, globals: { theme: "dark" } };
