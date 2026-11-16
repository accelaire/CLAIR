import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { ComprendreScreen } from "./ComprendreScreen.tsx";

const meta = {
  title: "Écrans/Comprendre",
  component: ComprendreScreen,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Route `/comprendre`. Accueil de la rubrique : une carte par fiche pédagogique et un lien vers le guide pratique. Page éditoriale, sans appel à l'API.",
      },
    },
  },
} satisfies Meta<typeof ComprendreScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Comprendre la politique française",
    );
    await expect(ecran.getAllByRole("heading", { level: 2 })).toHaveLength(7);
    // Au clavier, la première carte mène à la fiche « Le Parlement ».
    await userEvent.tab();
    const parlement = ecran.getByRole("link", { name: "Le Parlement" });
    await expect(parlement).toHaveFocus();
    await expect(parlement).toHaveAttribute("href", "/comprendre/parlement");
    await expect(ecran.getByRole("link", { name: "Découvrir le guide pratique" })).toHaveAttribute(
      "href",
      "/guide",
    );
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
