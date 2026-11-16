import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { attendreFocusVisible } from "../../story-utils.ts";
import { Footer } from "./Footer.tsx";
import { footerExemple } from "./fixtures.ts";

const meta = {
  title: "Composants/Mise en page/Footer",
  component: Footer,
  args: footerExemple,
  argTypes: {
    columns: {
      description: "Colonnes de liens, chacune avec un titre.",
      table: { category: "Contenu" },
    },
    sources: { description: "Producteurs des données affichées.", table: { category: "Contenu" } },
    tagline: { description: "Phrase sous la marque.", table: { category: "Contenu" } },
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "Pied de page : colonnes de liens, réseaux et sources des données.",
      },
    },
  },
} satisfies Meta<typeof Footer>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Colonnes nommées (une navigation par colonne), liens internes, sources en liens externes
 * annoncés ; la tabulation part de la marque puis suit l'ordre des colonnes.
 */
export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("contentinfo")).toBeVisible();
    for (const titre of ["Explorer", "Ressources", "Légal"]) {
      await expect(canvas.getByRole("navigation", { name: titre })).toBeVisible();
      await expect(canvas.getByRole("heading", { level: 2, name: titre })).toBeVisible();
    }
    const explorer = within(canvas.getByRole("navigation", { name: "Explorer" }));
    await expect(explorer.getAllByRole("link")).toHaveLength(4);
    await expect(explorer.getByRole("link", { name: "Députés" })).toHaveAttribute(
      "href",
      "/deputes",
    );
    const source = canvas.getByRole("link", { name: "HATVP (nouvelle fenêtre)" });
    await expect(source).toHaveAttribute("target", "_blank");
    await expect(canvas.getByText(/© 2026 CLAIR\./)).toBeVisible();

    const marque = canvas.getByRole("link", { name: "CLAIR, accueil" });
    await userEvent.tab();
    await attendreFocusVisible(marque);
    await userEvent.tab();
    await attendreFocusVisible(explorer.getByRole("link", { name: "Députés" }));
  },
};

export const Mobile: Story = { ...Defaut, globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { ...Defaut, globals: { theme: "dark" } };
