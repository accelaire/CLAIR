import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import { AccueilScreen } from "./AccueilScreen.tsx";
import { homepageExemple } from "./fixtures.ts";

const PATH = "/";
const API = "/homepage";
const navigate = fn();

const meta = {
  title: "Écrans/Accueil",
  component: AccueilScreen,
  args: {},
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, { [API]: homepageExemple }, navigate),
    docs: {
      description: {
        component:
          "Route `/`. Accroche et recherche, chiffres clés (calculés par CLAIR), agenda des prochains jours et échéances, derniers dossiers discutés, puis contenu éditorial (fonctionnalités, questions fréquentes, soutien). Données fictives.",
      },
    },
  },
} satisfies Meta<typeof AccueilScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent(
      "La politique française, en clair",
    );
    const chiffres = await ecran.findByRole("list", { name: "Chiffres clés" });
    await expect(within(chiffres).getByRole("link", { name: /Députés/ })).toHaveTextContent("577");
    await userEvent.type(
      ecran.getByRole("searchbox", { name: "Rechercher un député, un département, un scrutin" }),
      "  Paris ",
    );
    await userEvent.click(ecran.getByRole("button", { name: "Rechercher" }));
    await expect(navigate).toHaveBeenCalledWith("/recherche?q=Paris");
  },
};

export const QuestionsFrequentes: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    const question = ecran.getByRole("button", { name: "Quel est l'objectif de CLAIR ?" });
    await expect(question).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(question);
    await expect(question).toHaveAttribute("aria-expanded", "false");
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { [API]: jamais }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("status")).toHaveTextContent("Chargement de l'agenda");
    // L'accroche et le contenu éditorial n'attendent pas l'API.
    await expect(ecran.getByRole("heading", { name: "Questions fréquentes" })).toBeInTheDocument();
  },
};

export const Vide: Story = {
  parameters: parametresEcran(PATH, {
    [API]: {
      ...homepageExemple,
      trendingDossiers: [],
      upcoming: { events: [], evenements: [], echeances: [] },
    },
  }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByText("Aucun événement à venir")).toBeInTheDocument();
    await expect(
      ecran.queryByRole("heading", { name: "Derniers dossiers législatifs discutés" }),
    ).toBeNull();
  },
};

export const Erreur: Story = {
  parameters: parametresEcran(PATH, { [API]: enErreur(500, API) }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("alert")).toHaveTextContent(
      "L'agenda n'a pas pu être chargé",
    );
    await expect(ecran.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
