import type { Meta, StoryObj } from "@storybook/react-vite";
import { ResultatVote } from "./ResultatVote.tsx";

const meta = {
  title: "Composants/Parlementaire/ResultatVote",
  component: ResultatVote,
  args: { pour: 312, contre: 205, abstention: 41, label: "Répartition des voix", size: "md" },
  argTypes: {
    pour: { description: "Voix pour (`nombrePour`).", table: { category: "Contenu" } },
    contre: { description: "Voix contre (`nombreContre`).", table: { category: "Contenu" } },
    abstention: {
      description: "Abstentions (`nombreAbstention`).",
      table: { category: "Contenu" },
    },
    label: { description: "Intitulé du graphique.", table: { category: "Contenu" } },
    size: {
      description: "Taille de la barre et de la légende.",
      control: { type: "inline-radio", labels: { sm: "Petit", md: "Moyen" } },
      options: ["sm", "md"],
      table: { category: "Apparence" },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Barre de répartition pour / contre / abstention, toujours doublée de sa légende chiffrée. Remplace les barres en ligne des scrutins et `BarreEtats` de apps/web.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ResultatVote>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const Rejete: Story = { args: { pour: 98, contre: 230, abstention: 15 } };

export const Egalite: Story = { args: { pour: 150, contre: 150, abstention: 3 } };

export const Vide: Story = { args: { pour: 0, contre: 0, abstention: 0 } };

export const Petit: Story = { args: { size: "sm" } };

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { globals: { theme: "dark" } };
