import type { Meta, StoryObj } from "@storybook/react-vite";
import { flopExemple, topExemple } from "../timeline-fixtures.ts";
import { TopFlop } from "./TopFlop.tsx";

const meta = {
  title: "Composants/Parlementaire/TopFlop",
  component: TopFlop,
  args: {
    criterion: "Présence aux scrutins",
    top: topExemple,
    flop: flopExemple,
    formatValue: (value: number) => `${value} %`,
  },
  argTypes: {
    criterion: { description: "Critère du classement.", table: { category: "Contenu" } },
    top: { description: "Valeurs les plus élevées.", table: { category: "Données" } },
    flop: { description: "Valeurs les moins élevées.", table: { category: "Données" } },
    topTitle: { description: "Titre de la liste haute.", table: { category: "Contenu" } },
    flopTitle: { description: "Titre de la liste basse.", table: { category: "Contenu" } },
    headingLevel: {
      description: "Niveau des titres de liste.",
      control: { type: "inline-radio" },
      options: [2, 3, 4],
      table: { category: "Structure" },
    },
    provenance: {
      description: "Nature des valeurs (calculée par CLAIR par défaut).",
      control: {
        type: "select",
        labels: { officielle: "Officielle", calculee: "Calculée par CLAIR", ia: "Générée par IA" },
      },
      options: ["officielle", "calculee", "ia"],
      table: { category: "Donnée" },
    },
    methodologyHref: { description: "Lien vers la méthodologie.", table: { category: "Donnée" } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Deux listes « les plus » / « les moins » sur un critère, avec rang, nom et valeur en texte, sans couleur de jugement (personnes fictives). Remplace `TopFlopCards` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof TopFlop>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const AvecMethodologie: Story = {
  args: {
    criterion: "Amendements déposés",
    formatValue: undefined,
    methodologyHref: "#methodologie",
  },
};

export const Vide: Story = { args: { top: [], flop: [] } };

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { globals: { theme: "dark" } };
