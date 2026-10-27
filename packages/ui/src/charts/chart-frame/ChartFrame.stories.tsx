import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { BarChart } from "../bar-chart/BarChart.tsx";
import { seriesVotesExemple, tableVotesExemple, votesParMoisExemple } from "../fixtures.ts";
import { ChartFrame } from "./ChartFrame.tsx";

const meta = {
  title: "Composants/Graphiques/ChartFrame",
  component: ChartFrame,
  args: {
    title: "Votes du groupe par mois",
    subtitle: "Exemple : nombre de scrutins par position, session 2024-2025",
    provenance: "calculee",
    source: {
      label: "Assemblée nationale, open data",
      href: "https://data.assemblee-nationale.fr",
    },
    table: tableVotesExemple,
    children: (
      <BarChart data={votesParMoisExemple} categoryKey="mois" series={seriesVotesExemple} />
    ),
  },
  argTypes: {
    title: { description: "Titre du graphique.", table: { category: "Contenu" } },
    subtitle: { description: "Périmètre, période, unité.", table: { category: "Contenu" } },
    headingLevel: {
      description: "Niveau du titre dans la page.",
      control: { type: "inline-radio" },
      options: [2, 3, 4],
      table: { category: "Structure" },
    },
    provenance: {
      description: "Nature de la donnée, toujours affichée.",
      control: {
        type: "select",
        labels: { officielle: "Officielle", calculee: "Calculée par CLAIR", ia: "Générée par IA" },
      },
      options: ["officielle", "calculee", "ia"],
      table: { category: "Donnée" },
    },
    methodologyHref: { description: "Lien vers la méthodologie.", table: { category: "Donnée" } },
    note: { description: "Précision sur la méthode.", table: { category: "Donnée" } },
    source: { description: "Source des données.", table: { category: "Donnée" } },
    table: {
      description: "Alternative textuelle obligatoire : le tableau des données.",
      table: { category: "Accessibilité" },
    },
    children: { description: "Le graphique.", table: { category: "Contenu" } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Cadre de tout graphique : titre, nature et source de la donnée, et alternative textuelle (tableau) révélée par « Afficher les données ». Remplace `CadreGraphique` et `ChartTooltip` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof ChartFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

/** Le bouton révèle le tableau des données, puis le masque. */
export const AvecTableau: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bouton = canvas.getByRole("button", { name: "Afficher les données" });
    await userEvent.click(bouton);
    await expect(bouton).toHaveAttribute("aria-expanded", "true");
    await expect(
      canvas.getByRole("table", { name: "Votes du groupe par mois (exemple)" }),
    ).toBeVisible();
  },
};

export const DonneeOfficielle: Story = {
  args: {
    provenance: "officielle",
    note: "Décompte des scrutins publics publiés par l'Assemblée nationale.",
  },
};

export const AvecMethodologie: Story = {
  args: { methodologyHref: "#methodologie", note: "Moyenne sur la session." },
};

export const Mobile: Story = { ...AvecTableau, globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { ...AvecTableau, globals: { theme: "dark" } };
