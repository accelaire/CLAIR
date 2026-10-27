import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { navigationExemple } from "./fixtures.ts";
import { Header } from "./Header.tsx";

const meta = {
  title: "Composants/Mise en page/Header",
  component: Header,
  args: { navigation: navigationExemple, cta: { label: "Nous soutenir", href: "/soutenir" } },
  argTypes: {
    navigation: {
      description: "Rubriques : un lien ou un groupe de liens.",
      table: { category: "Contenu" },
    },
    cta: { description: "Appel à l'action à droite.", table: { category: "Contenu" } },
    searchHref: { description: "Adresse de la recherche.", table: { category: "Contenu" } },
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "En-tête du site : rubriques en menus déroulants accessibles au clavier, recherche, thème, appel à l'action ; tiroir sur mobile.",
      },
    },
  },
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

/** Une rubrique s'ouvre au clic et liste ses pages. */
export const MenuOuvert: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rubrique = canvas.getByRole("button", { name: "Parlementaires" });
    await userEvent.click(rubrique);
    await expect(rubrique).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(canvas.getByRole("link", { name: "Députés" })).toBeVisible());
    await userEvent.keyboard("{Escape}");
    await expect(rubrique).toHaveAttribute("aria-expanded", "false");
    await expect(rubrique).toHaveFocus();
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { globals: { theme: "dark" } };
