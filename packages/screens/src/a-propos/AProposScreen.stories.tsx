import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { AProposScreen } from "./AProposScreen.tsx";

const meta = {
  title: "Écrans/À propos",
  component: AProposScreen,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Route `/a-propos`. Mission, offre, valeurs, projet open source et contact. Page éditoriale, sans appel à l'API.",
      },
    },
  },
} satisfies Meta<typeof AProposScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Rendre la politique lisible",
    );
    await expect(ecran.getAllByRole("heading", { level: 2 })).toHaveLength(5);
    // Au clavier, le premier arrêt est le lien vers GitHub, qui s'ouvre dans un nouvel onglet.
    await userEvent.tab();
    const github = ecran.getByRole("link", { name: /Voir sur GitHub/ });
    await expect(github).toHaveFocus();
    await expect(github).toHaveAttribute("target", "_blank");
    await expect(
      ecran.getByRole("link", { name: "En savoir plus sur la méthodologie" }),
    ).toHaveAttribute("href", "/methodologie");
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
