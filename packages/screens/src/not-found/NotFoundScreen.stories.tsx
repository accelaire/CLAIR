import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { NotFoundScreen } from "./NotFoundScreen.tsx";

const meta = {
  title: "Écrans/Page introuvable",
  component: NotFoundScreen,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Page 404 du site (`not-found.tsx`) : message et chemins de repli vers l'accueil et la recherche. Sans appel à l'API.",
      },
    },
  },
} satisfies Meta<typeof NotFoundScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent("Page introuvable");
    // Au clavier : le champ de recherche, son bouton, puis l'accueil et la page de recherche.
    await userEvent.tab();
    await expect(ecran.getByRole("searchbox", { name: /Rechercher un élu/ })).toHaveFocus();
    await userEvent.tab();
    await expect(ecran.getByRole("button", { name: "Rechercher" })).toHaveFocus();
    await userEvent.tab();
    await expect(ecran.getByRole("link", { name: "Revenir à l'accueil" })).toHaveFocus();
    await userEvent.tab();
    const recherche = ecran.getByRole("link", { name: "Faire une recherche" });
    await expect(recherche).toHaveFocus();
    await expect(recherche).toHaveAttribute("href", "/recherche");
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
