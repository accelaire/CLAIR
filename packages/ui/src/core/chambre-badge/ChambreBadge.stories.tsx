import type { Meta, StoryObj } from "@storybook/react-vite";
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

export const Court: Story = { args: { short: true }, render: LesDeux };

export const Petit: Story = { args: { size: "sm", short: true }, render: LesDeux };

export const Sombre: Story = { render: LesDeux, globals: { theme: "dark" } };
