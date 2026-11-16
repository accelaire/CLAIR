import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import { CirconscriptionScreen } from "./CirconscriptionScreen.tsx";
import { candidatsGironde, listeSortants, resultatsGirondeExemple } from "./fixtures.ts";

const PATH = "/senatoriales-2026/gironde";
const SORTANTS = "/senatoriales/2026/sortants";
const CANDIDATS = "/senatoriales/2026/candidats";
const routes = { [SORTANTS]: listeSortants(), [CANDIDATS]: candidatsGironde };

const meta = {
  title: "Écrans/Sénatoriales 2026 : une circonscription",
  component: CirconscriptionScreen,
  args: {
    circonscription: { code: "33", nom: "Gironde", nbSieges: 6 },
    nbCirconscriptions: 64,
    maintenant: "2026-09-20T12:00:00+02:00",
    params: {},
  },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, routes),
    docs: {
      description: {
        component:
          "Route `/senatoriales-2026/[departement]`. Avant le scrutin, les candidats et le bilan des sortants ; le jour même, l'attente des résultats ; ensuite les élus, la répartition des sièges et le sort des sortants. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof CirconscriptionScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Sénatoriales 2026 en Gironde",
    );
    await expect(
      await ecran.findByRole("heading", { name: "2 candidats en Gironde" }),
    ).toBeInTheDocument();
    await expect(ecran.getByRole("link", { name: "Dominique Modèle" })).toHaveAttribute(
      "href",
      "/senateurs/dominique-modele",
    );
    await expect(ecran.getByRole("link", { name: /Voir les 64 départements/ })).toHaveAttribute(
      "href",
      "/senatoriales-2026",
    );
  },
};

export const Resultats: Story = {
  args: { maintenant: resultatsGirondeExemple.maintenant, resultats: resultatsGirondeExemple },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByText("Liste arrivée en tête")).toBeInTheDocument();
    await expect(
      ecran.getByRole("heading", { name: "Comment les 6 sièges ont été répartis" }),
    ).toBeInTheDocument();
    await expect(ecran.getByText("Réélu le 27 septembre")).toBeInTheDocument();
  },
};

export const Vide: Story = {
  parameters: parametresEcran(PATH, { ...routes, [SORTANTS]: listeSortants([]) }),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/bilan de mandature des sortants de cette/),
    ).toBeInTheDocument();
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { [SORTANTS]: jamais, [CANDIDATS]: jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement des sortants",
    );
  },
};

export const Erreur: Story = {
  parameters: parametresEcran(PATH, {
    [SORTANTS]: enErreur(500, SORTANTS),
    [CANDIDATS]: enErreur(500, CANDIDATS),
  }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect((await ecran.findAllByRole("alert")).length).toBeGreaterThan(0);
    await expect(ecran.getAllByRole("button", { name: "Réessayer" }).length).toBeGreaterThan(0);
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
