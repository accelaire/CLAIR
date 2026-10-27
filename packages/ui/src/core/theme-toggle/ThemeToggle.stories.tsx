import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeToggle } from "./ThemeToggle.tsx";

const meta = {
  title: "Composants/Fondations/ThemeToggle",
  component: ThemeToggle,
  parameters: {
    docs: { description: { component: "Bouton de bascule entre les thèmes clair et sombre." } },
  },
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};
export const Sombre: Story = { globals: { theme: "dark" } };
