import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { GUIDE_ARTICLES, type GuideSlug } from "./articles/index.ts";
import { GuideArticleScreen } from "./GuideArticleScreen.tsx";

const slugs = Object.keys(GUIDE_ARTICLES) as GuideSlug[];

const meta = {
  title: "Écrans/Parcours du guide",
  component: GuideArticleScreen,
  args: { slug: "decouvrir-mon-depute" },
  argTypes: {
    slug: {
      description: "Parcours à afficher : son contenu vit dans `articles/<slug>.ts`.",
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
          "Routes `/guide/<parcours>` (une route statique par parcours : une adresse inconnue n'atteint pas l'écran). Fil d'Ariane, chapeau, étapes numérotées en intertitres, lien pour commencer et parcours voisins. Page éditoriale, sans appel à l'API.",
      },
    },
  },
} satisfies Meta<typeof GuideArticleScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Une story par parcours : titre, étapes en intertitres et lien pour commencer. */
const parcours = (slug: GuideSlug): Story => ({
  args: { slug },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    const article = GUIDE_ARTICLES[slug];
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent(article.title);
    await expect(ecran.getByRole("navigation", { name: "Fil d'Ariane" })).toHaveTextContent(
      "Guide pratique",
    );
    await expect(ecran.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(
      article.steps.map((step) => step.title),
    );
    await expect(
      ecran.getByRole("link", { name: new RegExp(`^Commencer.*${article.start.label}$`) }),
    ).toHaveAttribute("href", article.start.href);
  },
});

export const Defaut: Story = {
  play: async (context) => {
    await parcours("decouvrir-mon-depute").play?.(context);
    const ecran = within(context.canvasElement);
    // Premier parcours : pas de précédent, le suivant est « Suivre un sujet ».
    const voisins = ecran.getByRole("navigation", { name: "Autres parcours du guide" });
    await expect(voisins).not.toHaveTextContent("Précédent");
    await expect(voisins.querySelector('a[href="/guide/suivre-un-sujet"]')).not.toBeNull();
    // Au clavier, le premier arrêt est le fil d'Ariane.
    await userEvent.tab();
    await expect(ecran.getByRole("link", { name: "Accueil" })).toHaveFocus();
  },
};

export const DecouvrirMonDepute = parcours("decouvrir-mon-depute");
export const SuivreUnSujet = parcours("suivre-un-sujet");
export const ComparerDesElus = parcours("comparer-des-elus");
export const ComprendreLeLobbying = parcours("comprendre-le-lobbying");
export const DecrypterUnScrutin = parcours("decrypter-un-scrutin");

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
