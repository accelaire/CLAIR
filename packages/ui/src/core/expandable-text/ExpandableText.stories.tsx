import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { ExpandableText } from "./ExpandableText.tsx";

const texteLong = `Cet amendement vise à préciser les conditions dans lesquelles les collectivités territoriales peuvent mutualiser leurs services techniques.

Il prévoit qu'une convention fixe la répartition des charges entre les collectivités concernées, ainsi que les modalités de suivi de cette mutualisation. Un bilan est transmis chaque année aux assemblées délibérantes, afin que les élus puissent apprécier les effets de la mesure sur la qualité du service rendu et sur les finances locales.`;

const meta = {
  title: "Composants/Fondations/ExpandableText",
  component: ExpandableText,
  args: { children: texteLong, maxLength: 200 },
  argTypes: {
    children: { description: "Texte complet.", table: { category: "Contenu" } },
    maxLength: {
      description: "Nombre de caractères affichés replié.",
      control: { type: "number", min: 20 },
      table: { category: "Comportement" },
    },
    defaultExpanded: {
      description: "Texte déplié au premier rendu.",
      control: "boolean",
      table: { category: "Comportement" },
    },
    expandLabel: { description: "Libellé du bouton replié.", table: { category: "Contenu" } },
    collapseLabel: { description: "Libellé du bouton déplié.", table: { category: "Contenu" } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Texte long replié avec un bouton « Lire la suite » / « Réduire ». Un texte court s'affiche sans bouton. Remplace `ExpandableText` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof ExpandableText>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const Court: Story = {
  args: { children: "Amendement rédactionnel." },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button")).toBeNull();
  },
};

/** Le bouton déplie le texte, puis le replie. */
export const Deplie: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Lire la suite" });
    await userEvent.click(button);
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(button).toHaveAccessibleName("Réduire");
    await expect(canvas.getByText(/finances locales/)).toBeVisible();
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { globals: { theme: "dark" } };
