import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { attendreFocusVisible } from "../../story-utils.ts";
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

/**
 * Le dessin est masqué aux lecteurs d'écran, la légende reste en texte ; le survol d'une barre
 * affiche l'infobulle, et le tableau des données s'ouvre et se referme au clavier.
 */
export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const legende = canvas.getByRole("list", { name: "Légende" });
    const series = within(legende)
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    await expect(series).toEqual(["Pour", "Contre", "Abstention"]);

    const dessin = canvasElement.querySelector("svg.recharts-surface")?.closest("[aria-hidden]");
    await expect(dessin).toHaveAttribute("aria-hidden", "true");
    // Recharts suit la position du pointeur : on la donne au survol de la première barre.
    const barre = canvasElement.querySelector(".recharts-bar-rectangle path");
    const surface = canvasElement.querySelector(".recharts-wrapper");
    if (!barre || !surface) throw new Error("Aucune barre dessinée");
    const { left, top, width, height } = barre.getBoundingClientRect();
    const position = { clientX: left + width / 2, clientY: top + height / 2 };
    fireEvent.mouseEnter(surface, position);
    fireEvent.mouseMove(surface, position);
    await waitFor(() =>
      expect(canvasElement.querySelector(".recharts-tooltip-wrapper")).toHaveTextContent(
        /Janvier.*Pour.*42/,
      ),
    );
    fireEvent.mouseLeave(surface);

    const bouton = canvas.getByRole("button", { name: "Afficher les données" });
    await userEvent.tab();
    await attendreFocusVisible(bouton);
    await userEvent.keyboard("{Enter}");
    await expect(bouton).toHaveAttribute("aria-expanded", "true");
    const tableau = canvas.getByRole("table", { name: "Données du graphique (exemple)" });
    await expect(tableau).toBeVisible();
    await expect(within(tableau).getAllByRole("row")).toHaveLength(5);
    await userEvent.keyboard(" ");
    await expect(bouton).toHaveAccessibleName("Afficher les données");
    await expect(bouton).toHaveAttribute("aria-expanded", "false");
  },
};

export const Empilees: Story = {
  args: { type: "stacked" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("list", { name: "Légende" })).toBeVisible();
    await expect(canvasElement.querySelectorAll(".recharts-bar-rectangle").length).toBe(12);
  },
};

/** Une seule série : pas de légende, le tableau garde les libellés longs. */
export const Horizontal: Story = {
  args: {
    data: commissionsExemple,
    categoryKey: "commission",
    series: [{ key: "membres", label: "Membres" }],
    horizontal: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("list", { name: "Légende" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Afficher les données" }));
    await expect(canvas.getByRole("cell", { name: "Lois constitutionnelles" })).toBeVisible();
  },
};

export const Vide: Story = {
  args: { data: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Aucune donnée à représenter")).toBeVisible();
    await expect(canvas.queryByRole("list", { name: "Légende" })).toBeNull();
  },
};

export const Mobile: Story = { ...Empilees, globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { ...Empilees, globals: { theme: "dark" } };
