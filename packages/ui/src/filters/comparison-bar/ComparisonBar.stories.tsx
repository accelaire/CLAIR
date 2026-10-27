import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { ComparisonBar, type ComparisonBarProps, type ComparisonItem } from "./ComparisonBar.tsx";

/** Élus fictifs. */
const elus: ComparisonItem[] = [
  { id: "camille-exemple", name: "Camille Exemple", detail: "SOC" },
  { id: "dominique-modele", name: "Dominique Modèle", detail: "EPR" },
  { id: "sacha-specimen", name: "Sacha Spécimen", detail: "DR" },
  { id: "alex-fictif", name: "Alex Fictif", detail: "ECO" },
];

/** Rend la sélection contrôlée, comme un écran qui la tient dans l'URL. */
const Controlled = (args: ComparisonBarProps) => {
  const [items, setItems] = useState(args.items);
  return (
    <div style={{ minHeight: 200 }}>
      <ComparisonBar
        {...args}
        items={items}
        onRemove={(id) => {
          setItems((current) => current.filter((item) => item.id !== id));
          args.onRemove(id);
        }}
        onClear={() => {
          setItems([]);
          args.onClear?.();
        }}
      />
    </div>
  );
};

const meta = {
  title: "Composants/Filtres/ComparisonBar",
  component: ComparisonBar,
  render: Controlled,
  args: {
    items: elus.slice(0, 2),
    onRemove: fn(),
    onClear: fn(),
    compareHref: "/comparer?elus=camille-exemple,dominique-modele",
    max: 4,
    noun: ["député", "députés"],
  },
  argTypes: {
    items: { description: "Élus sélectionnés (contrôlés).", table: { category: "Valeur" } },
    compareHref: { description: "Adresse de la comparaison.", table: { category: "Contenu" } },
    max: { description: "Nombre maximal d'élus.", table: { category: "Comportement" } },
    noun: { description: "Nom des éléments (singulier, pluriel).", table: { category: "Contenu" } },
    fixed: { description: "Fixée en bas de l'écran.", table: { category: "Apparence" } },
    onRemove: { description: "Retire un élu.", table: { category: "Événements" } },
    onClear: { description: "Vide la sélection.", table: { category: "Événements" } },
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Barre fixée en bas de l'écran listant les élus à comparer, chacun retirable ; le lien « Comparer » s'active à partir de deux élus. Remplace `comparison/ComparisonSelectionBar.tsx` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof ComparisonBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

/** Sans sélection, la barre n'est pas affichée. */
export const Vide: Story = { args: { items: [] } };

/** Un seul élu : « Comparer » reste désactivé et l'aide l'explique. */
export const UnSeul: Story = {
  args: { items: elus.slice(0, 1) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const compare = canvas.getByRole("button", { name: "Comparer" });
    await expect(compare).toBeDisabled();
    await expect(compare).toHaveAccessibleDescription(
      "Sélectionnez au moins 2 députés pour les comparer.",
    );
  },
};

export const Complet: Story = { args: { items: elus } };

/** Retirer un élu fait repasser sous le seuil de comparaison. */
export const Retrait: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "Comparer" })).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Retirer Camille Exemple de la comparaison" }),
    );
    await expect(args.onRemove).toHaveBeenCalledWith("camille-exemple");
    await expect(canvas.getByRole("status")).toHaveTextContent("1 député sélectionné sur 4");
    await expect(canvas.getByRole("button", { name: "Comparer" })).toBeDisabled();
  },
};

export const Mobile: Story = {
  args: { items: elus.slice(0, 3) },
  globals: { viewport: { value: "xs" } },
};

export const Sombre: Story = { globals: { theme: "dark" } };
