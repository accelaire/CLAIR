import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import { ComparateurScreen } from "./ComparateurScreen.tsx";
import { amendementsCamille, compareExemple, votesCamille, votesDominique } from "./fixtures.ts";

const PATH = "/deputes/comparer";
const API = "/deputes/compare";
const routes = {
  [API]: compareExemple,
  "/deputes/camille-exemple/votes": votesCamille,
  "/deputes/dominique-test/votes": votesDominique,
  "/deputes/camille-exemple/amendements": amendementsCamille,
};
const navigate = fn();

const meta = {
  title: "Écrans/Comparateur",
  component: ComparateurScreen,
  args: { chambre: "assemblee", params: { slugs: "camille-exemple,dominique-test" } },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, routes, navigate),
    docs: {
      description: {
        component:
          "Routes `/deputes/comparer` et `/senateurs/comparer`. Statistiques comparées, positions de vote par scrutin et amendements de deux élus ou plus, choisis dans l'URL. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof ComparateurScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent("Comparaison");
    const stats = await ecran.findByRole("table", { name: "Statistiques comparées" });
    await expect(
      within(stats)
        .getAllByRole("columnheader")
        .map((th) => th.textContent),
    ).toEqual(["Indicateur", "Camille Exemple", "Dominique Test"]);
    await userEvent.click(
      await ecran.findByLabelText("Uniquement les scrutins où les positions diffèrent"),
    );
    await expect(navigate).toHaveBeenCalledWith(
      `${PATH}?slugs=camille-exemple%2Cdominique-test&divergents=1`,
    );
  },
};

export const Amendements: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    const bouton = await ecran.findByRole("button", {
      name: "Voir les derniers amendements de Camille Exemple",
    });
    await userEvent.click(bouton);
    const liste = await ecran.findByRole("list", { name: "Amendements de Camille Exemple" });
    await expect(await within(liste).findAllByRole("heading", { level: 4 })).toHaveLength(10);
    await expect(
      ecran.getByRole("button", { name: "Masquer les amendements de Camille Exemple" }),
    ).toHaveAttribute("aria-expanded", "true");
  },
};

export const SelectionInsuffisante: Story = {
  args: { params: { slugs: "camille-exemple" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByText("Sélection insuffisante")).toBeInTheDocument();
    await expect(ecran.getByRole("link", { name: /Choisir des députés/ })).toHaveAttribute(
      "href",
      "/deputes?compare=camille-exemple",
    );
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { ...routes, [API]: jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement de la comparaison",
    );
  },
};

export const Erreur: Story = {
  parameters: parametresEcran(PATH, { ...routes, [API]: enErreur(500, API) }),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole("alert")).toHaveTextContent(
      "Le chargement a échoué",
    );
  },
};

export const Introuvable: Story = {
  parameters: parametresEcran(PATH, { ...routes, [API]: { data: [] } }),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("Députés introuvables"),
    ).toBeInTheDocument();
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
