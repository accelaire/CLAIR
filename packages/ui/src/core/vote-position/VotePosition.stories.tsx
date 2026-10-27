import type { Meta, StoryObj } from "@storybook/react-vite";
import { VotePosition } from "./VotePosition.tsx";

const meta = {
  title: "Composants/Fondations/VotePosition",
  component: VotePosition,
  args: { position: "pour", size: "md" },
  argTypes: {
    position: {
      description: "Position de vote ; toujours une icône et un libellé.",
      control: {
        type: "select",
        labels: {
          pour: "Pour",
          contre: "Contre",
          abstention: "Abstention",
          absent: "Absent",
          non_votant: "Non-votant",
        },
      },
      options: ["pour", "contre", "abstention", "absent", "non_votant"],
      table: { category: "Contenu" },
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
          "Position de vote d'un parlementaire : icône et libellé, jamais la couleur seule. Fusionne les `VotePositionBadge` des fiches député et sénateur de apps/web.",
      },
    },
  },
} satisfies Meta<typeof VotePosition>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const Positions: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <VotePosition {...args} position="pour" />
      <VotePosition {...args} position="contre" />
      <VotePosition {...args} position="abstention" />
      <VotePosition {...args} position="absent" />
      <VotePosition {...args} position="non_votant" />
    </div>
  ),
};

export const Petit: Story = { ...Positions, args: { size: "sm" } };

export const Mobile: Story = { ...Positions, globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { ...Positions, globals: { theme: "dark" } };
