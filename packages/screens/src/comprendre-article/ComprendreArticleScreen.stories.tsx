import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { COMPRENDRE_ARTICLES, type ComprendreSlug } from "./articles/index.ts";
import { ComprendreArticleScreen } from "./ComprendreArticleScreen.tsx";

const slugs = Object.keys(COMPRENDRE_ARTICLES) as ComprendreSlug[];

const meta = {
  title: "Écrans/Fiche Comprendre",
  component: ComprendreArticleScreen,
  args: { slug: "parlement" },
  argTypes: {
    slug: {
      description: "Fiche à afficher : son contenu vit dans `articles/<slug>.ts`.",
      control: { type: "select" },
      options: slugs,
      table: { category: "Contenu" },
    },
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Routes `/comprendre/<fiche>` (une route statique par fiche : une adresse inconnue n'atteint pas l'écran). Fil d'Ariane, titre, encart de données en direct éventuel, sections, liens d'exploration et fiches voisines. Page éditoriale, sans appel à l'API.",
      },
    },
  },
} satisfies Meta<typeof ComprendreArticleScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Une story par fiche : titre, fil d'Ariane et intertitres de ses sections. */
const fiche = (slug: ComprendreSlug): Story => ({
  args: { slug },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    const article = COMPRENDRE_ARTICLES[slug];
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent(article.title);
    await expect(ecran.getByRole("navigation", { name: "Fil d'Ariane" })).toHaveTextContent(
      "Comprendre",
    );
    const intertitres = ecran.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    for (const section of article.sections) await expect(intertitres).toContain(section.title);
    await expect(
      ecran.getByRole("navigation", { name: "Autres fiches Comprendre" }),
    ).toBeInTheDocument();
  },
});

export const Defaut: Story = {
  args: { slug: "parlementaire" },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent("Le parlementaire");
    // Les fiches voisines : le Parlement avant, le scrutin après.
    const voisines = ecran.getByRole("navigation", { name: "Autres fiches Comprendre" });
    await expect(voisines.querySelector('a[href="/comprendre/parlement"]')).not.toBeNull();
    await expect(voisines.querySelector('a[href="/comprendre/scrutin"]')).not.toBeNull();
    // Au clavier, le premier arrêt est le fil d'Ariane.
    await userEvent.tab();
    await expect(ecran.getByRole("link", { name: "Accueil" })).toHaveFocus();
  },
};

export const Parlement = fiche("parlement");
export const Parlementaire = fiche("parlementaire");
export const Scrutin = fiche("scrutin");

/** La liste des sorts d'un amendement se déplie et se replie. */
export const DossierLegislatif: Story = {
  args: { slug: "dossier-legislatif" },
  play: async (context) => {
    await fiche("dossier-legislatif").play?.(context);
    const ecran = within(context.canvasElement);
    await expect(ecran.queryByText("En traitement")).toBeNull();
    const plus = ecran.getByRole("button", { name: "Voir 28 autres sorts" });
    await expect(plus).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(plus);
    await expect(ecran.getByText("En traitement")).toBeInTheDocument();
    const moins = ecran.getByRole("button", { name: "Masquer" });
    await expect(moins).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(moins);
    await expect(ecran.queryByText("En traitement")).toBeNull();
  },
};

export const GroupesPolitiques = fiche("groupes-politiques");
export const Lobbying = fiche("lobbying");

/** Seule fiche avec l'encart de données en direct. */
export const Commissions: Story = {
  args: { slug: "commissions" },
  play: async (context) => {
    await fiche("commissions").play?.(context);
    const ecran = within(context.canvasElement);
    await expect(ecran.getByRole("link", { name: "Voir les commissions" })).toHaveAttribute(
      "href",
      "/commissions",
    );
    await expect(ecran.getByRole("link", { name: "Consulter l'agenda" })).toHaveAttribute(
      "href",
      "/agenda",
    );
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
