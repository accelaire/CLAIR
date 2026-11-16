import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { attendreFocusVisible } from "../../story-utils.ts";
import { Link } from "./Link.tsx";

const meta = {
  title: "Composants/Fondations/Link",
  component: Link,
  args: { href: "/deputes", children: "Voir les députés", external: false, onClick: fn() },
  argTypes: {
    href: { description: "Adresse du lien.", table: { category: "Contenu" } },
    external: {
      description: "Lien vers un autre site : nouvel onglet, annoncé aux lecteurs d'écran.",
      control: "boolean",
      table: { category: "Comportement" },
    },
    children: {
      description: "Texte du lien, explicite hors contexte.",
      table: { category: "Contenu" },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Lien de texte rendu par le routeur de l'application. Remplace les `next/link` des composants.",
      },
    },
  },
} satisfies Meta<typeof Link>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Atteint à la tabulation, contour de focus visible, suivi à Entrée comme au clic. */
export const Defaut: Story = {
  play: async ({ args, canvasElement }) => {
    const lien = within(canvasElement).getByRole("link", { name: "Voir les députés" });
    await expect(lien).toHaveAttribute("href", "/deputes");
    await expect(lien).not.toHaveAttribute("target");
    await userEvent.tab();
    await attendreFocusVisible(lien);
    await userEvent.keyboard("{Enter}");
    await expect(args.onClick).toHaveBeenCalledTimes(1);
    await userEvent.click(lien);
    await expect(args.onClick).toHaveBeenCalledTimes(2);
  },
};

/** Nouvel onglet, sans accès à la page d'origine, annoncé dans le nom accessible. */
export const Externe: Story = {
  args: {
    href: "https://www.assemblee-nationale.fr",
    external: true,
    children: "Site de l'Assemblée nationale",
  },
  play: async ({ canvasElement }) => {
    const lien = within(canvasElement).getByRole("link", {
      name: "Site de l'Assemblée nationale (nouvelle fenêtre)",
    });
    await expect(lien).toHaveAttribute("target", "_blank");
    await expect(lien).toHaveAttribute("rel", "noopener noreferrer");
    await userEvent.tab();
    await attendreFocusVisible(lien);
  },
};

export const Mobile: Story = { ...Externe, globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { globals: { theme: "dark" } };
