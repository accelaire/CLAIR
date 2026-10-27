import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartFrame } from "../chart-frame/ChartFrame.tsx";
import { commissionsExemple, seriesVotesExemple, votesParMoisExemple } from "../fixtures.ts";
import { BarChart } from "./BarChart.tsx";

const meta = {
  title: "Composants/Graphiques/BarChart",
  component: BarChart,
  args: {
    data: votesParMoisExemple,
    categoryKey: "mois",
    series: seriesVotesExemple,
    type: "default",
    horizontal: false,
  },
  argTypes: {
    data: { description: "Lignes de données.", table: { category: "Données" } },
    categoryKey: { description: "Clé de la catégorie.", table: { category: "Données" } },
    series: {
      description: "Séries : clé, libellé et couleur (variable de token).",
      table: { category: "Données" },
    },
    type: {
      description: "Disposition des barres.",
      control: {
        type: "inline-radio",
        labels: { default: "Côte à côte", stacked: "Empilées", percent: "Empilées en %" },
      },
      options: ["default", "stacked", "percent"],
      table: { category: "Apparence" },
    },
    horizontal: {
      description: "Barres horizontales (libellés longs).",
      control: "boolean",
      table: { category: "Apparence" },
    },
    height: { description: "Hauteur en pixels.", table: { category: "Apparence" } },
    unit: { description: "Unité des valeurs.", table: { category: "Contenu" } },
    withLegend: { description: "Légende des séries.", table: { category: "Contenu" } },
  },
  decorators: [
    (Story, { args }) => (
      <ChartFrame
        title="Graphique en barres"
        subtitle="Données d'exemple"
        provenance="calculee"
        table={{
          caption: "Données du graphique (exemple)",
          columns: [
            { key: args.categoryKey, label: "Catégorie" },
            ...args.series.map((serie) => ({ key: serie.key, label: serie.label })),
          ],
          rows: args.data,
        }}
      >
        <Story />
      </ChartFrame>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Barres simples, groupées ou empilées (@mantine/charts), toujours dans un `ChartFrame` qui porte l'alternative textuelle. Remplace `BarresComptage` et les graphiques Recharts de apps/web.",
      },
    },
  },
} satisfies Meta<typeof BarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const Empilees: Story = { args: { type: "stacked" } };

export const Horizontal: Story = {
  args: {
    data: commissionsExemple,
    categoryKey: "commission",
    series: [{ key: "membres", label: "Membres" }],
    horizontal: true,
  },
};

export const Vide: Story = { args: { data: [] } };

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { globals: { theme: "dark" } };
