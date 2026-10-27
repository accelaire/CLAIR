import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { type SortOption, SortSelect, type SortSelectProps } from "./SortSelect.tsx";

/** Critères de tri des classements (apps/web classements/SortSelect.tsx). */
const options: SortOption[] = [
  { value: "presence", label: "Présence" },
  { value: "loyaute", label: "Loyauté" },
  { value: "amendements", label: "Amendements" },
  { value: "interventions", label: "Interventions" },
  { value: "nom", label: "Alphabétique" },
];

/** Rend le tri contrôlé, comme un écran qui synchronise la valeur avec l'URL. */
const Controlled = (args: SortSelectProps) => {
  const [value, setValue] = useState(args.value);
  return (
    <div style={{ maxWidth: 280 }}>
      <SortSelect
        {...args}
        value={value}
        onChange={(next) => {
          setValue(next);
          args.onChange(next);
        }}
      />
    </div>
  );
};

const meta = {
  title: "Composants/Filtres/SortSelect",
  component: SortSelect,
  render: Controlled,
  args: { value: "presence", options, onChange: fn() },
  argTypes: {
    value: { description: "Tri choisi (contrôlé).", table: { category: "Valeur" } },
    options: { description: "Critères proposés.", table: { category: "Contenu" } },
    label: { description: "Libellé du champ.", table: { category: "Contenu" } },
    hideLabel: { description: "Masque visuellement le libellé.", table: { category: "Apparence" } },
    disabled: { description: "Champ désactivé.", table: { category: "États" } },
    onChange: { description: "Appelé au changement de tri.", table: { category: "Événements" } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Choix du tri d'une liste, en liste déroulante native libellée. Remplace `classements/SortSelect.tsx` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof SortSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const LibelleMasque: Story = { args: { hideLabel: true } };

export const Periode: Story = {
  args: {
    label: "Période",
    value: "mandat",
    options: [
      { value: "mandat", label: "Mandat en cours" },
      { value: "carriere", label: "Carrière complète" },
    ],
  },
};

export const Desactive: Story = { args: { disabled: true } };

/** Le choix d'un critère au clavier est transmis à l'écran. */
export const Choix: Story = {
  play: async ({ args, canvasElement }) => {
    const select = within(canvasElement).getByRole("combobox", { name: "Trier par" });
    await userEvent.selectOptions(select, "nom");
    await expect(args.onChange).toHaveBeenCalledWith("nom");
    await expect(select).toHaveValue("nom");
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { globals: { theme: "dark" } };
