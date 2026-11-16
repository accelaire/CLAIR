import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { GUIDE_ORDER } from "../guide-article/articles/index.ts";
import { GuideScreen } from "./GuideScreen.tsx";

const meta = {
  title: "Écrans/Guide pratique",
  component: GuideScreen,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Route `/guide`. Accueil du guide pratique : une carte par parcours et un lien vers les fiches « Comprendre ». Page éditoriale, sans appel à l'API.",
      },
    },
  },
} satisfies Meta<typeof GuideScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent("Guide pratique");
    await expect(ecran.getAllByRole("heading", { level: 2 })).toHaveLength(GUIDE_ORDER.length);
    // Au clavier, la première carte mène au premier parcours.
    const [premier] = GUIDE_ORDER;
    await userEvent.tab();
    await expect(ecran.getByRole("link", { name: premier?.title })).toHaveFocus();
    await expect(
      ecran.getByRole("link", { name: "Consultez nos pages pédagogiques" }),
    ).toHaveAttribute("href", "/comprendre");
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
