import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ProvenanceLabel } from "./ProvenanceLabel.tsx";

const meta = {
  title: "Composants/Fondations/ProvenanceLabel",
  component: ProvenanceLabel,
  args: { provenance: "officielle", size: "sm" },
  argTypes: {
    provenance: {
      description:
        "Nature de la donnée. Toujours dite par un libellé, jamais par la couleur seule.",
      control: {
        type: "inline-radio",
        labels: { officielle: "Officielle", calculee: "Calculée par CLAIR", ia: "Générée par IA" },
      },
      options: ["officielle", "calculee", "ia"],
      table: { category: "Contenu" },
    },
    source: { description: "Producteur de la donnée.", table: { category: "Contenu" } },
    methodologyHref: {
      description: "Adresse de la méthodologie : le libellé devient un lien.",
      table: { category: "Comportement" },
    },
    size: {
      description: "Taille de l'étiquette.",
      control: { type: "inline-radio", labels: { sm: "Petite", md: "Moyenne" } },
      options: ["sm", "md"],
      table: { category: "Apparence" },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Nature d'une donnée : officielle, calculée par CLAIR ou générée par IA. Règle centrale de CLAIR : toujours distinguer ces trois natures.",
      },
    },
  },
} satisfies Meta<typeof ProvenanceLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const Provenances: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <ProvenanceLabel {...args} provenance="officielle" />
      <ProvenanceLabel {...args} provenance="calculee" />
      <ProvenanceLabel {...args} provenance="ia" />
    </div>
  ),
};

export const AvecSource: Story = { args: { source: "Assemblée nationale" } };

/** Le libellé mène à la méthodologie. */
export const AvecMethodologie: Story = {
  args: { provenance: "ia", methodologyHref: "/methodologie#ia" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("link", { name: "Générée par IA, à vérifier (méthodologie)" }),
    ).toHaveAttribute("href", "/methodologie#ia");
  },
};

export const Moyen: Story = { ...Provenances, args: { size: "md" } };

export const Mobile: Story = { ...Provenances, globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { ...Provenances, globals: { theme: "dark" } };
