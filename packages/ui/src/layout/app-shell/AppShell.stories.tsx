import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { attendreFocusVisible } from "../../story-utils.ts";
import { Footer } from "../footer/Footer.tsx";
import { footerExemple } from "../footer/fixtures.ts";
import { navigationExemple } from "../header/fixtures.ts";
import { Header } from "../header/Header.tsx";
import { AppShell } from "./AppShell.tsx";

const meta = {
  title: "Composants/Mise en page/AppShell",
  component: AppShell,
  args: {
    header: (
      <Header navigation={navigationExemple} cta={{ label: "Nous soutenir", href: "/soutenir" }} />
    ),
    footer: <Footer {...footerExemple} />,
    children: (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 16px" }}>
        <h1>Titre de la page</h1>
        <p>Contenu de la page.</p>
      </div>
    ),
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Cadre de toutes les pages : lien d'évitement, en-tête, contenu principal, pied de page.",
      },
    },
  },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Le lien d'évitement est le premier arrêt du clavier et mène au contenu principal. */
export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const evitement = canvas.getByRole("link", { name: "Aller au contenu" });
    await userEvent.tab();
    await attendreFocusVisible(evitement);
    await expect(evitement).toHaveAttribute("href", "#contenu");
    const principal = canvas.getByRole("main");
    await expect(principal).toHaveAttribute("id", "contenu");
    await expect(principal).toHaveAttribute("tabindex", "-1");
    await expect(within(principal).getByRole("heading", { level: 1 })).toBeVisible();
    await expect(canvas.getByRole("banner")).toBeVisible();
    await expect(canvas.getByRole("contentinfo")).toBeVisible();
  },
};

/**
 * Menu mobile : le bouton l'ouvre dans un tiroir, Échap le ferme et rend le focus au bouton ;
 * le bouton « fermer » du tiroir le ferme aussi.
 */
export const Mobile: Story = {
  globals: { viewport: { value: "xs" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const burger = canvas.getByRole("button", { name: "Ouvrir le menu" });
    await expect(burger).toHaveAttribute("aria-expanded", "false");

    // Ouverture au clavier : le tiroir (portail Mantine) est rendu hors du canevas.
    burger.focus();
    await userEvent.keyboard("{Enter}");
    const tiroir = await screen.findByRole("dialog", { name: "Menu" });
    await expect(burger).toHaveAttribute("aria-expanded", "true");
    await expect(burger).toHaveAccessibleName("Fermer le menu");
    const navigation = within(tiroir).getByRole("navigation", {
      name: "Navigation principale (mobile)",
    });
    await waitFor(() =>
      expect(within(navigation).getByRole("link", { name: "Députés" })).toBeVisible(),
    );

    // Échap ferme le tiroir et rend le focus au bouton.
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull());
    await expect(burger).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(burger).toHaveFocus());

    // Réouverture au clic, fermeture par le bouton du tiroir.
    await userEvent.click(burger);
    const rouvert = await screen.findByRole("dialog", { name: "Menu" });
    await userEvent.click(within(rouvert).getByRole("button", { name: "Fermer le menu" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull());
    await expect(burger).toHaveAccessibleName("Ouvrir le menu");
  },
};

/** Menu mobile laissé ouvert : le tiroir est vérifié par axe, bouton de fermeture compris. */
export const MenuMobileOuvert: Story = {
  globals: { viewport: { value: "xs" } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Ouvrir le menu" }));
    const tiroir = await screen.findByRole("dialog", { name: "Menu" });
    await waitFor(() =>
      expect(within(tiroir).getByRole("button", { name: "Fermer le menu" })).toBeVisible(),
    );
    await expect(within(tiroir).getByRole("link", { name: "Nous soutenir" })).toBeVisible();
  },
};

export const Sombre: Story = { globals: { theme: "dark" } };
