import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import { apercuExemple, listeSortants } from "./fixtures.ts";
import { GraphiqueScreen } from "./GraphiqueScreen.tsx";
import type { SlugGraphique } from "./lib/graphiques.ts";

const PATH = "/senatoriales-2026/graphiques/ages";
const API = "/senatoriales/2026";
const SORTANTS = `${API}/sortants`;
const routes = { [API]: apercuExemple, [SORTANTS]: listeSortants() };

const meta = {
  title: "Écrans/Sénatoriales 2026 : un graphique",
  component: GraphiqueScreen,
  args: { slug: "ages", params: {} },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, routes),
    docs: {
      description: {
        component:
          "Route `/senatoriales-2026/graphiques/[slug]`. Un graphique des sortants en pleine page, avec son tableau de données, son image à télécharger et les autres lectures en tête. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof GraphiqueScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent("L’âge des sortants");
    await expect(ecran.getByRole("link", { name: "Départements" })).toHaveAttribute(
      "href",
      "/senatoriales-2026/graphiques/carte",
    );
    await expect(
      await ecran.findByRole("table", { name: "Sortants par tranche d'âge et par sexe" }),
    ).toBeInTheDocument();
  },
};

export const Carte: Story = {
  args: { slug: "carte" },
  parameters: parametresEcran("/senatoriales-2026/graphiques/carte", routes),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole("heading", { level: 1 })).toHaveTextContent(
      "Où se joue le renouvellement",
    );
  },
};

export const Presence: Story = {
  args: { slug: "presence" },
  parameters: parametresEcran("/senatoriales-2026/graphiques/presence", routes),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole("heading", { level: 1 })).toHaveTextContent(
      "Présence et loyauté des sortants",
    );
  },
};

/** Une story par autre lecture : chaque graphique est vérifié par axe. */
const lecture = (slug: SlugGraphique, titre: string): Story => ({
  args: { slug },
  parameters: parametresEcran(`/senatoriales-2026/graphiques/${slug}`, routes),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole("heading", { level: 1 })).toHaveTextContent(
      titre,
    );
  },
});

export const Groupes = lecture("groupes", "Ce que chaque groupe remet en jeu");
export const Activite = lecture("activite", "Interventions et amendements");
export const Commissions = lecture("commissions", "Les sortants par commission");
export const Professions = lecture("professions", "D’où viennent les sortants");

export const Vide: Story = {
  parameters: parametresEcran(PATH, { ...routes, [SORTANTS]: listeSortants([]) }),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("Les données ne sont pas disponibles pour le moment."),
    ).toBeInTheDocument();
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { [API]: jamais, [SORTANTS]: jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement du graphique",
    );
  },
};

export const Erreur: Story = {
  parameters: parametresEcran(PATH, { [API]: apercuExemple, [SORTANTS]: enErreur(500, SORTANTS) }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("alert")).toBeInTheDocument();
    await expect(ecran.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
