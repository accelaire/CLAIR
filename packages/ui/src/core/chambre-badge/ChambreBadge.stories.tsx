import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ChambreBadge } from "./ChambreBadge.tsx";

const meta = {
  title: "Composants/Fondations/ChambreBadge",
  component: ChambreBadge,
  args: { chambre: "assemblee", short: false, size: "md" },
  argTypes: {
    chambre: {
      description: "Chambre du Parlement.",
      control: {
        type: "inline-radio",
        labels: { assemblee: "Assemblée nationale", senat: "Sénat" },
      },
      options: ["assemblee", "senat"],
      table: { category: "Contenu" },
    },
    short: {
      description: "Libellé court ; le nom complet reste lu par les lecteurs d'écran.",
      control: "boolean",
      table: { category: "Apparence" },
    },
    size: {
      description: "Taille du badge.",
      control: { type: "inline-radio", labels: { sm: "Petit", md: "Moyen" } },
      options: ["sm", "md"],
      table: { category: "Apparence" },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Chambre du Parlement, couleur doublée du nom. Remplace `.badge-assemblee` et `.badge-senat` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof ChambreBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

const LesDeux: Story["render"] = (args) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
    <ChambreBadge {...args} chambre="assemblee" />
    <ChambreBadge {...args} chambre="senat" />
  </div>
);

export const Chambres: Story = { render: LesDeux };

/** En version courte, le nom complet reste donné en infobulle et aux lecteurs d'écran. */
export const Court: Story = {
  args: { short: true },
  render: LesDeux,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const court = canvas.getByText("AN");
    await expect(court).toHaveAttribute("aria-hidden", "true");
    await expect(court.parentElement).toHaveAttribute("title", "Assemblée nationale");
    await expect(canvas.getByText("Assemblée nationale")).toHaveClass("clair-visually-hidden");
    // « Sénat » n'a pas de forme courte : ni infobulle ni double libellé.
    await expect(canvas.getByText("Sénat")).not.toHaveAttribute("title");
  },
};

export const Petit: Story = { args: { size: "sm", short: true }, render: LesDeux };

export const Mobile: Story = { render: LesDeux, globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { render: LesDeux, globals: { theme: "dark" } };
