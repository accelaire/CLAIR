import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { attendreFocusVisible } from "../../story-utils.ts";
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

/**
 * Deux listes ordonnées nommées par leur titre ; rang, nom (lien) et valeur en texte, le critère
 * lu avec chaque valeur ; la nature calculée de la donnée est affichée.
 */
export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const haut = within(
      canvas.getByRole("region", { name: /^Les plus élevés\s*—\s*Présence aux scrutins$/ }),
    );
    const bas = within(
      canvas.getByRole("region", { name: /^Les moins élevés\s*—\s*Présence aux scrutins$/ }),
    );
    const premiers = haut.getAllByRole("listitem");
    await expect(premiers).toHaveLength(5);
    await expect(premiers[0]).toHaveTextContent("Rang 1Camille Exemple");
    await expect(premiers[0]).toHaveTextContent("Présence aux scrutins : 99 %");
    // Rang du classement complet, pas la position dans la liste.
    await expect(bas.getAllByRole("listitem")[0]).toHaveTextContent("Rang 577");
    await expect(canvas.getByText("Calculée par CLAIR")).toBeVisible();

    const lien = haut.getByRole("link", { name: "Camille Exemple" });
    await expect(lien).toHaveAttribute("href", "#parlementaire");
    await userEvent.tab();
    await attendreFocusVisible(lien);
    await userEvent.tab();
    await attendreFocusVisible(haut.getByRole("link", { name: "Dominique Modèle" }));
  },
};

/** Sans formatage : nombres à la française ; le libellé de provenance mène à la méthodologie. */
export const AvecMethodologie: Story = {
  args: {
    criterion: "Amendements déposés",
    formatValue: undefined,
    methodologyHref: "#methodologie",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const methodologie = canvas.getByRole("link", {
      name: "Calculée par CLAIR (méthodologie)",
    });
    await expect(methodologie).toHaveAttribute("href", "#methodologie");
    methodologie.focus();
    await expect(methodologie).toHaveFocus();
    for (const item of canvas.getAllByRole("listitem")) {
      await expect(item).toHaveTextContent(/Amendements déposés : \d+$/);
    }
  },
};

export const Vide: Story = {
  args: { top: [], flop: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("Aucun résultat")).toHaveLength(2);
    await expect(canvas.queryByRole("list")).toBeNull();
  },
};

export const Mobile: Story = { ...Defaut, globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { ...Defaut, globals: { theme: "dark" } };
