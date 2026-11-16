import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { ContactScreen } from "./ContactScreen.tsx";

const meta = {
  title: "Écrans/Contact",
  component: ContactScreen,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Route `/contact`. Canaux de contact (email, X, issues GitHub), contribution au projet et délai de réponse. Pas de formulaire : chaque canal est un lien. Page éditoriale, sans appel à l'API.",
      },
    },
  },
} satisfies Meta<typeof ContactScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent("Contact");
    await expect(ecran.getAllByRole("heading", { level: 2 })).toHaveLength(5);
    // Au clavier, le premier arrêt est l'adresse email.
    await userEvent.tab();
    const email = ecran.getByRole("link", { name: "contact@clair.vote" });
    await expect(email).toHaveFocus();
    await expect(email).toHaveAttribute("href", "mailto:contact@clair.vote");
    await expect(ecran.getByRole("link", { name: /Ouvrir une issue/ })).toHaveAttribute(
      "href",
      "https://github.com/accelaire/CLAIR/issues/new?labels=bug",
    );
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
