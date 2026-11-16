import type { Query } from "@clair/api-client";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import {
  ancienneDeputee,
  apercuExemple,
  apercuVide,
  commissionDissoute,
  deputeExemple,
  pageDeputes,
} from "./fixtures.ts";
import { RechercheScreen } from "./RechercheScreen.tsx";

const PATH = "/recherche";
const navigate = fn();
const apercu = { "/search": apercuExemple() };

const meta = {
  title: "Écrans/Recherche",
  component: RechercheScreen,
  args: { params: { q: "exemple" } },
  parameters: {
    layout: "fullscreen",
    // Pas de réponse commune à `/search` : Storybook fusionne en profondeur les paramètres de
    // l'écran et ceux d'une story, et mêlerait l'aperçu aux pages d'une catégorie.
    ...parametresEcran(PATH, {}, navigate),
    docs: {
      description: {
        component:
          "Route `/recherche`. Recherche dans tout CLAIR : un aperçu par catégorie (parlementaires, scrutins, dossiers, commissions…) avec leurs comptes, le détail d'une catégorie avec chargement des résultats suivants, et l'option d'inclure les résultats archivés. Terme et filtres dans l'URL. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof RechercheScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Une recherche avec résultats : l'aperçu par catégorie. */
export const Defaut: Story = {
  parameters: parametresEcran(PATH, apercu, navigate),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent("Recherche");
    const deputes = await ecran.findByRole("region", { name: /Députés/ });
    await expect(within(deputes).getByRole("link", { name: "Camille Exemple" })).toHaveAttribute(
      "href",
      "/deputes/camille-exemple",
    );
    await expect(ecran.getByRole("button", { name: /Tout\s?\(13\)/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(
      within(deputes).getByRole("button", { name: "Voir les 12 résultats : Députés" }),
    );
    await expect(navigate).toHaveBeenCalledWith("/recherche?q=exemple&type=deputes");
  },
};

/** Une recherche sans résultat. */
export const SansResultat: Story = {
  args: { params: { q: "zzz" } },
  parameters: parametresEcran(PATH, { "/search": apercuVide() }),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("Aucun résultat trouvé"),
    ).toBeInTheDocument();
  },
};

/** Avant toute saisie. */
export const Invite: Story = {
  args: { params: {} },
  parameters: parametresEcran(PATH, {}),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Commencez à taper pour rechercher"),
    ).toBeInTheDocument();
  },
};

/** Une catégorie, avec les résultats suivants chargés à la demande. */
export const Categorie: Story = {
  args: { params: { q: "exemple", type: "deputes" } },
  parameters: parametresEcran(PATH, {
    "/search": (query: Query) =>
      query.page === 1
        ? pageDeputes([deputeExemple], { total: 2, hasNext: true })
        : pageDeputes([ancienneDeputee], { page: 2, total: 2 }),
  }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByText("1 résultat affiché sur 2")).toBeInTheDocument();
    await userEvent.click(await ecran.findByRole("button", { name: "Afficher plus de résultats" }));
    await expect(await ecran.findByRole("link", { name: "Dominique Exemple" })).toBeInTheDocument();
    await expect(await ecran.findByText("2 résultats affichés sur 2")).toBeInTheDocument();
  },
};

/** Résultats archivés inclus : mandat clos et commission dissoute dits en texte. */
export const AvecArchives: Story = {
  args: { params: { q: "exemple", type: "deputes", anciens: "1" } },
  parameters: parametresEcran(PATH, {
    "/search": pageDeputes([ancienneDeputee, commissionDissoute], { inclureAnciens: true }),
  }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(
      (await ecran.findByRole("link", { name: "Dominique Exemple" })).closest("li"),
    ).toHaveTextContent("Ancienne députée · XVIe législature");
    await expect(
      ecran.getByRole("link", { name: "Commission d'enquête exemple" }).closest("li"),
    ).toHaveTextContent("Dissoute");
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { "/search": jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent("Recherche en cours");
  },
};

export const Erreur: Story = {
  parameters: parametresEcran(PATH, { "/search": enErreur(500, "/search") }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("alert")).toHaveTextContent("Une erreur est survenue");
    await expect(ecran.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  parameters: parametresEcran(PATH, apercu),
  globals: { viewport: { value: "xs" } },
};
export const Sombre: Story = {
  parameters: parametresEcran(PATH, apercu),
  globals: { theme: "dark" },
};
