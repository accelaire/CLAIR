import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { MethodologieScreen } from "./MethodologieScreen.tsx";

const meta = {
  title: "Écrans/Méthodologie",
  component: MethodologieScreen,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Route `/methodologie`. Sources officielles, synchronisation, enrichissement par IA (donnée générée, distinguée de la donnée officielle), modèle de données, stack et limites. Les ancres `#hatvp` et `#enrichissement-ia` sont citées ailleurs. Page éditoriale, sans appel à l'API.",
      },
    },
  },
} satisfies Meta<typeof MethodologieScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent("Méthodologie");
    await expect(ecran.getAllByRole("heading", { level: 2 })).toHaveLength(7);
    await expect(
      ecran.getByRole("heading", { level: 4, name: "Note sur le comptage" }),
    ).toBeInTheDocument();
    await expect(canvasElement.querySelector("#hatvp")).not.toBeNull();
    await expect(canvasElement.querySelector("#enrichissement-ia")).not.toBeNull();
    // Au clavier, le premier arrêt est le sommaire, qui mène à la première section.
    await userEvent.tab();
    await expect(ecran.getByRole("link", { name: "Sources de données" })).toHaveFocus();
    // Après les six liens du sommaire, le site de la première source, dans un nouvel onglet.
    for (let i = 0; i < 6; i++) await userEvent.tab();
    const source = ecran.getByRole("link", { name: /data\.assemblee-nationale\.fr/ });
    await expect(source).toHaveFocus();
    await expect(source).toHaveAttribute("target", "_blank");
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
