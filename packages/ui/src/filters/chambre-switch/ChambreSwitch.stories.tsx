import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { ChambreSwitch, type ChambreSwitchProps } from "./ChambreSwitch.tsx";

/** Rend le choix contrôlé, comme un écran qui synchronise la valeur avec l'URL. */
const Controlled = (args: ChambreSwitchProps) => {
  const [value, setValue] = useState(args.value);
  return (
    <ChambreSwitch
      {...args}
      value={value}
      onChange={(next) => {
        setValue(next);
        args.onChange(next);
      }}
    />
  );
};

const meta = {
  title: "Composants/Filtres/ChambreSwitch",
  component: ChambreSwitch,
  render: Controlled,
  args: { value: "", onChange: fn(), legend: "Chambre" },
  argTypes: {
    value: {
      description: "Chambre choisie ; chaîne vide = les deux.",
      control: {
        type: "inline-radio",
        labels: { "": "Les deux", assemblee: "Assemblée nationale", senat: "Sénat" },
      },
      options: ["", "assemblee", "senat"],
      table: { category: "Valeur" },
    },
    legend: { description: "Légende du groupe.", table: { category: "Contenu" } },
    hideLegend: {
      description: "Masque visuellement la légende.",
      table: { category: "Apparence" },
    },
    withBoth: { description: "Propose « Les deux ».", table: { category: "Comportement" } },
    compact: {
      description: "Sigle « AN » au lieu du nom complet.",
      table: { category: "Apparence" },
    },
    fullWidth: { description: "Toute la largeur.", table: { category: "Apparence" } },
    disabled: { description: "Choix désactivé.", table: { category: "États" } },
    onChange: {
      description: "Appelé au changement de chambre.",
      table: { category: "Événements" },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Choix de la chambre (Assemblée nationale, Sénat, les deux) en boutons radio avec légende. Fusionne `ChambreToggle` et `FiltreChambre` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof ChambreSwitch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const Assemblee: Story = { args: { value: "assemblee" } };

export const Senat: Story = { args: { value: "senat" } };

/** Sans « Les deux » : pour une fiche d'élu passé par les deux chambres. */
export const SansLesDeux: Story = { args: { value: "assemblee", withBoth: false } };

export const Compact: Story = { args: { compact: true, hideLegend: true } };

export const Desactive: Story = { args: { disabled: true } };

/** Les flèches du clavier passent d'une chambre à l'autre. */
export const Clavier: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const both = canvas.getByRole("radio", { name: "Les deux" });
    await expect(canvas.getByRole("radiogroup", { name: "Chambre" })).toBeInTheDocument();
    await userEvent.click(both);
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("radio", { name: "Assemblée nationale" })).toBeChecked();
    await expect(args.onChange).toHaveBeenLastCalledWith("assemblee");
  },
};

export const Mobile: Story = {
  args: { fullWidth: true, compact: true },
  globals: { viewport: { value: "xs" } },
};

export const Sombre: Story = { args: { value: "senat" }, globals: { theme: "dark" } };
