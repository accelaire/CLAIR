import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { ApiPresentationScreen } from "./ApiPresentationScreen.tsx";

const meta = {
  title: "Écrans/API ouverte",
  component: ApiPresentationScreen,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Route `/api`. Pourquoi une API ouverte, ressources disponibles (liens vers des exemples en direct), exemple `curl`, conditions d'utilisation et sources. Page éditoriale, sans appel à l'API.",
      },
    },
  },
} satisfies Meta<typeof ApiPresentationScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent("L'API ouverte CLAIR");
    // Au clavier, le premier arrêt est la documentation de l'API.
    await userEvent.tab();
    await expect(ecran.getByRole("link", { name: /Documentation de l'API/ })).toHaveFocus();
    await expect(ecran.getByRole("link", { name: /^Scrutins/ })).toHaveAttribute(
      "href",
      "https://api.clair.vote/api/v1/scrutins?limit=5",
    );
    await expect(ecran.getByRole("list", { name: "L'API en chiffres" })).toBeInTheDocument();
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
