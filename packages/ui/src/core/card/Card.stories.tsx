import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Badge } from "../badge/Badge.tsx";
import { Card } from "./Card.tsx";

const meta: Meta<typeof Card> = {
  title: "Composants/Fondations/Card",
  component: Card,
  args: {
    title: "Camille Exemple",
    titleAs: "h3",
    padding: "md",
    children: "Députée de la 1re circonscription de l'Exemple-sur-Mer.",
  },
  argTypes: {
    title: { description: "Titre de la carte.", table: { category: "Contenu" } },
    titleAs: {
      description: "Niveau du titre, selon la hiérarchie de la page.",
      control: { type: "select" },
      options: ["h2", "h3", "h4", "h5", "h6"],
      table: { category: "Accessibilité" },
    },
    as: {
      description: "Élément racine (`li` dans une liste de cartes).",
      control: { type: "select" },
      options: ["div", "article", "section", "li"],
      table: { category: "Accessibilité" },
    },
    eyebrow: {
      description: "Contenu au-dessus du titre (badge, catégorie).",
      control: false,
      table: { category: "Contenu" },
    },
    footer: { description: "Pied de carte.", table: { category: "Contenu" } },
    children: { description: "Contenu de la carte.", table: { category: "Contenu" } },
    padding: {
      description: "Marges intérieures.",
      control: { type: "inline-radio", labels: { sm: "Petites", md: "Moyennes", lg: "Grandes" } },
      options: ["sm", "md", "lg"],
      table: { category: "Apparence" },
    },
    href: {
      description:
        "Adresse : toute la carte devient un seul lien (le titre). Aucun autre élément interactif dedans.",
      table: { category: "Comportement" },
    },
    external: {
      description: "Lien vers un autre site : nouvel onglet, annoncé.",
      control: "boolean",
      table: { category: "Comportement" },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Surface qui regroupe un contenu ; cliquable en « lien bloc » (un seul lien, sans liens imbriqués). Remplace `.depute-card` et `.stat-card` de apps/web.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Defaut: Story = {};

export const AvecEnTete: Story = {
  args: {
    eyebrow: (
      <>
        <Badge tone="info" size="sm">
          Assemblée nationale
        </Badge>
        <Badge size="sm">RN</Badge>
      </>
    ),
    footer: "Mandat en cours depuis 2024",
  },
};

/** Toute la carte est cliquable, mais elle ne contient qu'un seul lien : son titre. */
export const Cliquable: Story = {
  args: {
    as: "article",
    href: "/deputes/camille-exemple",
    eyebrow: <Badge size="sm">LFI</Badge>,
    footer: "Voir la fiche",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("link")).toHaveLength(1);
    await expect(canvas.getByRole("link", { name: "Camille Exemple" })).toHaveAttribute(
      "href",
      "/deputes/camille-exemple",
    );
  },
};

export const SansTitre: Story = { args: { title: undefined } };

export const Mobile: Story = { ...Cliquable, globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { ...AvecEnTete, globals: { theme: "dark" } };
