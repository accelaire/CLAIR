import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import { groupesExemple, legislaturesExemple, listeExemple, pageListe } from "./fixtures.ts";
import { ParlementairesListeScreen } from "./ParlementairesListeScreen.tsx";

const PATH = "/deputes";
const API = "/deputes";
const routes = {
  [API]: listeExemple,
  "/deputes/groupes": groupesExemple,
  "/deputes/legislatures": legislaturesExemple,
};
const navigate = fn();

// Les mêmes élus fictifs, placés au Sénat.
const listeSenat = pageListe(
  listeExemple.data.map((elu) => ({ ...elu, chambre: "senat" as const })),
  { total: 30, totalPages: 2 },
);

const meta = {
  title: "Écrans/Liste des parlementaires",
  component: ParlementairesListeScreen,
  args: { chambre: "assemblee", params: {} },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, routes, navigate),
    docs: {
      description: {
        component:
          "Routes `/deputes` et `/senateurs`. Recherche, filtres (groupe, période, tri), cartes paginées et sélection pour le comparateur, gardés dans l'URL. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof ParlementairesListeScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent("Députés");
    await expect(await ecran.findByRole("link", { name: /Camille Exemple/ })).toHaveAttribute(
      "href",
      "/deputes/camille-exemple",
    );
    await ecran.findByRole("option", { name: "EXE (2)" });
    await userEvent.selectOptions(ecran.getByLabelText("Groupe politique"), "exemple");
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?groupe=exemple`);
  },
};

export const Comparaison: Story = {
  args: { params: { compare: "dominique-test" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await userEvent.click(await ecran.findByRole("checkbox", { name: /Comparer Camille Exemple/ }));
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?compare=dominique-test%2Ccamille-exemple`);
    await waitFor(() =>
      expect(ecran.getByRole("region", { name: "Comparaison" })).toHaveTextContent(
        "Dominique Test",
      ),
    );
  },
};

export const Senat: Story = {
  args: { chambre: "senat" },
  parameters: parametresEcran("/senateurs", {
    "/senateurs": listeSenat,
    "/senateurs/groupes": groupesExemple,
    "/senateurs/sessions": { data: [{ session: "2025", count: 30 }] },
  }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent("Sénateurs");
    await expect(await ecran.findByRole("link", { name: /Camille Exemple/ })).toBeInTheDocument();
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { ...routes, [API]: jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement des députés",
    );
  },
};

export const Vide: Story = {
  args: { params: { search: "zzz" } },
  parameters: parametresEcran(PATH, { ...routes, [API]: pageListe([]) }, navigate),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByText("Aucun député trouvé")).toBeInTheDocument();
    await userEvent.click(ecran.getByRole("button", { name: "Effacer les filtres" }));
    await expect(navigate).toHaveBeenCalledWith(PATH);
  },
};

export const Erreur: Story = {
  parameters: parametresEcran(PATH, { ...routes, [API]: enErreur(500, API) }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("alert")).toHaveTextContent("Le chargement a échoué");
    await expect(ecran.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
