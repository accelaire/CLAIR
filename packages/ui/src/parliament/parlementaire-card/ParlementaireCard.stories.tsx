import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { ancienDeputeExemple, deputeExemple, senateurExemple } from "../fixtures.ts";
import { ParlementaireCard, type ParlementaireCardProps } from "./ParlementaireCard.tsx";

const meta = {
  title: "Composants/Parlementaire/ParlementaireCard",
  component: ParlementaireCard,
  args: { parlementaire: deputeExemple, chambre: "assemblee", href: "#camille-exemple" },
  argTypes: {
    parlementaire: {
      description: "Parlementaire : nom, photo, groupe, circonscription, `actif`.",
      table: { category: "Contenu" },
    },
    chambre: {
      description: "Chambre du mandat.",
      control: { type: "inline-radio", labels: { assemblee: "Assemblée", senat: "Sénat" } },
      options: ["assemblee", "senat"],
      table: { category: "Contenu" },
    },
    href: { description: "Adresse de la fiche (unique lien).", table: { category: "Contenu" } },
    statut: { description: "Statut affiché en badge.", table: { category: "Contenu" } },
    selectable: {
      description: "Ajoute la case « Comparer » du comparateur.",
      control: "boolean",
      table: { category: "Comportement" },
    },
    selected: {
      description: "Case cochée.",
      control: "boolean",
      if: { arg: "selectable" },
      table: { category: "Comportement" },
    },
    selectionDisabled: {
      description: "Case désactivée (sélection pleine).",
      control: "boolean",
      if: { arg: "selectable" },
      table: { category: "Comportement" },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Carte d'un député ou d'un sénateur. Remplace `.depute-card`, les cartes des listes /deputes et /senateurs et `SortantCard`.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ParlementaireCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const Senateur: Story = {
  args: { parlementaire: senateurExemple, chambre: "senat", href: "#dominique-modele" },
};

export const AncienElu: Story = {
  args: { parlementaire: ancienDeputeExemple, href: "#alex-fictif" },
};

const Selectionnable = (args: ParlementaireCardProps) => {
  const [selected, setSelected] = useState(false);
  return (
    <ParlementaireCard {...args} selectable selected={selected} onSelectedChange={setSelected} />
  );
};

/** Mode comparateur : la case est distincte du lien de la fiche. */
export const ModeComparateur: Story = {
  render: (args) => <Selectionnable {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const caseComparer = canvas.getByRole("checkbox", { name: "Comparer Camille Exemple" });
    await userEvent.click(caseComparer);
    await expect(caseComparer).toBeChecked();
    await expect(canvas.getByRole("link", { name: "Camille Exemple" })).toBeVisible();
  },
};

export const SelectionPleine: Story = {
  args: { selectable: true, selected: false, selectionDisabled: true },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };

export const Sombre: Story = {
  args: { selectable: true, selected: true },
  globals: { theme: "dark" },
};
