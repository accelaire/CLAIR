import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { attendreFocusVisible } from "../../story-utils.ts";
import { SkipLink } from "./SkipLink.tsx";

const meta = {
  title: "Composants/Fondations/SkipLink",
  component: SkipLink,
  args: { target: "contenu", children: "Aller au contenu" },
  argTypes: {
    target: {
      description: "Identifiant de la zone de contenu principal.",
      table: { category: "Comportement" },
    },
    children: { description: "Libellé du lien.", table: { category: "Contenu" } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Lien d'évitement, premier arrêt du clavier. Visible seulement quand il a le focus.",
      },
    },
  },
} satisfies Meta<typeof SkipLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

/** La première tabulation affiche le lien, avec son contour de focus, vers le contenu. */
export const AuFocus: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    const link = within(canvasElement).getByRole("link", { name: "Aller au contenu" });
    await attendreFocusVisible(link);
    await expect(link).toHaveAttribute("href", "#contenu");
    await expect(link).toBeVisible();
  },
};

export const Mobile: Story = { ...AuFocus, globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { ...AuFocus, globals: { theme: "dark" } };
