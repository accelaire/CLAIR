import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import {
  classementExemple,
  colonnesClassement,
  type LigneClassement,
} from "../timeline-fixtures.ts";
import { DataTable } from "./DataTable.tsx";

const meta = {
  title: "Composants/Parlementaire/DataTable",
  component: DataTable<LigneClassement>,
  args: {
    caption: "Classement des parlementaires (exemple)",
    columns: colonnesClassement,
    rows: classementExemple,
    getRowKey: (row) => row.id,
  },
  argTypes: {
    caption: {
      description: "Légende obligatoire : nomme le tableau et sa zone de défilement.",
      table: { category: "Accessibilité" },
    },
    hideCaption: {
      description: "Masque visuellement la légende (elle reste lue).",
      control: "boolean",
      table: { category: "Accessibilité" },
    },
    columns: {
      description: "Colonnes typées : en-tête, cellule, valeur de tri, alignement.",
      table: { category: "Données" },
    },
    rows: { description: "Lignes.", table: { category: "Données" } },
    sort: { description: "Tri contrôlé.", table: { category: "Tri" } },
    defaultSort: { description: "Tri initial (non contrôlé).", table: { category: "Tri" } },
    manualSort: {
      description: "Lignes déjà triées par le serveur.",
      control: "boolean",
      table: { category: "Tri" },
    },
    emptyLabel: { description: "Titre de l'état vide.", table: { category: "Contenu" } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Tableau de données accessible et triable : légende, en-têtes `scope`, tri par boutons avec `aria-sort`, état vide, défilement horizontal focusable. Remplace `ClassementsTable` et `ComparisonVotesTable` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof DataTable<LigneClassement>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

/** Un clic trie la colonne, un second inverse le sens. */
export const Tri: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bouton = canvas.getByRole("button", { name: "Amendements" });
    await userEvent.click(bouton);
    await expect(canvas.getByRole("columnheader", { name: "Amendements" })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    await expect(canvas.getAllByRole("rowheader")[0]).toHaveTextContent("Élise Témoin");
    await userEvent.click(bouton);
    await expect(canvas.getByRole("columnheader", { name: "Amendements" })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  },
};

export const TriInitial: Story = {
  args: { defaultSort: { key: "presence", direction: "descending" }, hideCaption: true },
};

export const Vide: Story = { args: { rows: [] } };

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { globals: { theme: "dark" } };
