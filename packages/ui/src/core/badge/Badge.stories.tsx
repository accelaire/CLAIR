import type { Meta, StoryObj } from "@storybook/react-vite";
import { Check } from "lucide-react";
import { Badge } from "./Badge.tsx";

const meta = {
  title: "Composants/Fondations/Badge",
  component: Badge,
  args: { tone: "neutre", size: "md", children: "En cours" },
  argTypes: {
    tone: {
      description: "Ton du badge. La couleur est toujours doublée d'un libellé.",
      control: {
        type: "select",
        labels: {
          neutre: "Neutre",
          info: "Information",
          succes: "Succès",
          erreur: "Erreur",
          avertissement: "Avertissement",
        },
      },
      options: ["neutre", "info", "succes", "erreur", "avertissement"],
      table: { category: "Apparence" },
    },
    size: {
      description: "Taille du badge.",
      control: { type: "inline-radio", labels: { sm: "Petit", md: "Moyen" } },
      options: ["sm", "md"],
      table: { category: "Apparence" },
    },
    children: { description: "Libellé du badge.", table: { category: "Contenu" } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Étiquette courte de statut ou de catégorie. Remplace les classes `.badge-*` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const Tons: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <Badge {...args} tone="neutre">
        Caduc
      </Badge>
      <Badge {...args} tone="info">
        En cours
      </Badge>
      <Badge {...args} tone="succes">
        Adopté
      </Badge>
      <Badge {...args} tone="erreur">
        Rejeté
      </Badge>
      <Badge {...args} tone="avertissement">
        Important
      </Badge>
    </div>
  ),
};

export const Petit: Story = { args: { size: "sm", tone: "info", children: "Sénat" } };

export const AvecIcone: Story = {
  args: { tone: "succes", icon: <Check />, children: "Promulgué" },
};

export const Sombre: Story = { ...Tons, globals: { theme: "dark" } };
