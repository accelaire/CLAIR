import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { mandatsExemple, mandatUnique } from "../timeline-fixtures.ts";
import { MandatsTimeline } from "./MandatsTimeline.tsx";

const meta = {
  title: "Composants/Parlementaire/MandatsTimeline",
  component: MandatsTimeline,
  args: { mandats: mandatsExemple, sexe: "F" },
  argTypes: {
    mandats: {
      description: "Mandats (législature ou mandature), avec groupe d'époque et fonctions.",
      table: { category: "Données" },
    },
    sexe: {
      description: "Accord de la fonction (Députée, Sénateur…) quand les chambres se suivent.",
      control: { type: "inline-radio", labels: { F: "Féminin", M: "Masculin" } },
      options: ["F", "M"],
      table: { category: "Contenu" },
    },
    title: { description: "Titre du bloc.", table: { category: "Contenu" } },
    headingLevel: {
      description: "Niveau du titre dans la page.",
      control: { type: "inline-radio" },
      options: [2, 3, 4],
      table: { category: "Structure" },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Mandats et fonctions d'un parlementaire (personne fictive) : chambre, période, groupe d'époque, circonscription, fonctions en cours et anciennes. Fusionne `MandatsBlock` et `FonctionsMandat` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof MandatsTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const UnMandat: Story = { args: { mandats: mandatUnique } };

/** Les anciennes fonctions se déplient au clic. */
export const FonctionsDepliees: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bouton = canvas.getByRole("button", { name: "Anciennes fonctions (1)" });
    await userEvent.click(bouton);
    await expect(bouton).toHaveAttribute("aria-expanded", "true");
    await expect(canvas.getByText("Mission d'information sur les mobilités")).toBeVisible();
  },
};

export const Vide: Story = { args: { mandats: [] } };

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { globals: { theme: "dark" } };
