import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { ChartFrame } from "../chart-frame/ChartFrame.tsx";
import { groupesAssembleeExemple, groupesSenatExemple, tableDeGroupes } from "../fixtures.ts";
import { Hemicycle } from "./Hemicycle.tsx";

const meta = {
  title: "Composants/Graphiques/Hemicycle",
  component: Hemicycle,
  args: {
    groupes: groupesAssembleeExemple,
    totalSieges: 577,
    title: "Assemblée nationale (répartition d'exemple)",
  },
  argTypes: {
    groupes: {
      description: "Groupes, dans l'ordre d'affichage de gauche à droite fourni par les données.",
      table: { category: "Données" },
    },
    totalSieges: {
      description: "Sièges de la chambre (577 ou 348) ; le reste est affiché vacant.",
      table: { category: "Données" },
    },
    title: { description: "Titre, qui nomme aussi l'image.", table: { category: "Contenu" } },
    headingLevel: {
      description: "Niveau du titre ; `false` le masque visuellement.",
      control: { type: "select" },
      options: [2, 3, 4, false],
      table: { category: "Structure" },
    },
    description: {
      description: "Description textuelle ; générée à partir des groupes par défaut.",
      table: { category: "Accessibilité" },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Hémicycle en SVG : un point par siège, coloré par groupe, légende en texte (sigle et sièges), image décrite par la répartition complète. Remplace `HemicycleChart` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof Hemicycle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const Senat: Story = {
  args: {
    groupes: groupesSenatExemple,
    totalSieges: 348,
    title: "Sénat (répartition d'exemple)",
  },
};

export const SiegesVacants: Story = {
  args: {
    groupes: groupesSenatExemple.slice(0, -1),
    totalSieges: 348,
    title: "Sénat, avec sièges vacants (exemple)",
  },
};

/** Parcourir la légende au clavier met en avant les sièges d'un groupe. */
export const Survol: Story = {
  args: {
    groupes: groupesAssembleeExemple.map((groupe) => ({ ...groupe, href: "#groupe" })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    const lien = canvas.getAllByRole("link")[0];
    await expect(lien).toHaveFocus();
    await expect(lien?.closest("li")).toHaveAttribute("data-active");
  },
};

/** Dans un cadre de graphique : le tableau des groupes est l'alternative textuelle. */
export const DansUnCadre: Story = {
  render: (args) => (
    <ChartFrame
      title="Composition de l'Assemblée nationale"
      subtitle="Répartition d'exemple"
      provenance="officielle"
      table={tableDeGroupes("Sièges par groupe (exemple)", args.groupes)}
    >
      <Hemicycle {...args} headingLevel={false} />
    </ChartFrame>
  ),
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { globals: { theme: "dark" } };
