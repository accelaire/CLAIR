import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
  MultiSelectFilter,
  type MultiSelectFilterOption,
  type MultiSelectFilterProps,
} from "./MultiSelectFilter.tsx";

/** Secteurs d'activité d'exemple ; les nombres sont fictifs. */
const secteurs: MultiSelectFilterOption[] = [
  { value: "agriculture", label: "Agriculture", count: 412 },
  { value: "energie", label: "Énergie", count: 1280 },
  { value: "sante", label: "Santé", count: 958 },
  { value: "education", label: "Éducation", count: 87 },
  { value: "transports", label: "Transports", count: 301 },
  { value: "numerique", label: "Numérique", count: 640 },
];

const beaucoup: MultiSelectFilterOption[] = Array.from({ length: 40 }, (_, index) => ({
  value: `secteur-${index + 1}`,
  label: `Secteur d'exemple ${index + 1}`,
}));

/** Rend le filtre contrôlé, comme un écran qui synchronise la valeur avec l'URL. */
const Controlled = (args: MultiSelectFilterProps) => {
  const [value, setValue] = useState(args.value);
  return (
    <div style={{ maxWidth: 360 }}>
      <MultiSelectFilter
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
  title: "Composants/Filtres/MultiSelectFilter",
  component: MultiSelectFilter,
  render: Controlled,
  args: { label: "Secteurs", options: secteurs, value: [], onChange: fn() },
  argTypes: {
    label: { description: "Libellé visible du champ.", table: { category: "Contenu" } },
    options: {
      description: "Options proposées (nombre facultatif).",
      table: { category: "Contenu" },
    },
    value: { description: "Valeurs choisies (contrôlées).", table: { category: "Valeur" } },
    placeholder: { description: "Invite quand rien n'est choisi.", table: { category: "Contenu" } },
    maxValues: { description: "Nombre maximal de choix.", table: { category: "Comportement" } },
    disabled: { description: "Champ désactivé.", table: { category: "États" } },
    onChange: { description: "Appelé à chaque choix.", table: { category: "Événements" } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Filtre à choix multiple avec recherche insensible aux accents, nombre de choix annoncé. Remplace `components/MultiSelectFilter.tsx` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof MultiSelectFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const Vide: Story = { args: { options: [] } };

export const Selection: Story = { args: { value: ["energie", "sante"] } };

export const BeaucoupDOptions: Story = { args: { label: "Secteurs d'exemple", options: beaucoup } };

export const Desactive: Story = { args: { disabled: true, value: ["sante"] } };

/** Recherche sans accent, choix au clavier, nombre de choix annoncé. */
export const Recherche: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole("combobox", { name: "Secteurs" });
    await userEvent.click(field);
    await userEvent.type(field, "energ");
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole("option", { name: /Énergie/ })).toBeVisible());
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(args.onChange).toHaveBeenLastCalledWith(["energie"]);
    await expect(canvas.getByRole("status")).toHaveTextContent("1 élément choisi");
  },
};

export const Mobile: Story = {
  args: { value: ["energie"] },
  globals: { viewport: { value: "xs" } },
};

export const Sombre: Story = { args: { value: ["energie", "sante"] }, globals: { theme: "dark" } };
