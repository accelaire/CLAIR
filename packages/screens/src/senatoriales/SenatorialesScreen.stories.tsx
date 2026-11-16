import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import {
  apercuAvecCandidatures,
  apercuExemple,
  listeSortants,
  resultatsNationauxExemple,
} from "./fixtures.ts";
import { SenatorialesScreen } from "./SenatorialesScreen.tsx";

const PATH = "/senatoriales-2026";
const API = "/senatoriales/2026";
const routes = {
  [API]: apercuExemple,
  [`${API}/sortants`]: listeSortants(),
};
const navigate = fn();

const meta = {
  title: "Écrans/Sénatoriales 2026",
  component: SenatorialesScreen,
  args: { params: {} },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, routes, navigate),
    docs: {
      description: {
        component:
          "Route `/senatoriales-2026`. Renouvellement du Sénat : résultats dès l'ouverture du scrutin, candidatures, index des circonscriptions, carte et graphiques des sortants (une lecture par `?tri=`), filtres et bilan de mandature des sortants. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof SenatorialesScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Sénatoriales du 27 septembre 2026",
    );
    await expect(
      await ecran.findByText(/178 des 348 sièges du Sénat sont renouvelés/),
    ).toBeInTheDocument();
    await expect(ecran.getByRole("link", { name: /^Gironde 6 sièges$/ })).toHaveAttribute(
      "href",
      `${PATH}/gironde`,
    );
    await expect(ecran.getByRole("button", { name: "Département" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(ecran.getByRole("button", { name: "Présence" }));
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?tri=presence`);
  },
};

export const LecturePresence: Story = {
  args: { params: { tri: "presence" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(
      await ecran.findByRole("heading", { level: 2, name: "Présence et loyauté des sortants" }),
    ).toBeInTheDocument();
    await userEvent.click(
      ecran.getByRole("button", {
        name: /Surligner les sortants : présence aux votes solennels moins de 50 %/,
      }),
    );
    await expect(
      ecran.getByRole("link", { name: /Camille Fictif \(surligné\)/ }),
    ).toBeInTheDocument();
  },
};

/** Une story par autre lecture (`?tri=`) : chaque graphique de la page est vérifié par axe. */
const lecture = (tri: string): Story => ({
  args: { params: { tri } },
  play: async ({ canvasElement }) => {
    await expect(
      (await within(canvasElement).findAllByRole("heading", { level: 2 })).length,
    ).toBeGreaterThan(0);
  },
});

export const LectureGroupe = lecture("groupe");
export const LectureCommission = lecture("commission");
export const LectureProfession = lecture("profession");
export const LectureAge = lecture("age");
export const LectureAmendements = lecture("amendements");

export const Candidatures: Story = {
  parameters: parametresEcran(PATH, { ...routes, [API]: apercuAvecCandidatures }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(
      await ecran.findByRole("heading", { name: "Qui remet son siège en jeu ?" }),
    ).toBeInTheDocument();
    await expect(ecran.getAllByText("Se représente")).toHaveLength(1);
  },
};

export const Resultats: Story = {
  args: { resultats: resultatsNationauxExemple },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(
      await ecran.findByRole("heading", { name: "Suivi du scrutin" }),
    ).toBeInTheDocument();
    await expect(
      ecran.getByRole("table", {
        name: "Sièges par famille politique, avant et après le scrutin",
      }),
    ).toBeInTheDocument();
  },
};

export const Vide: Story = {
  args: { params: { search: "personne-introuvable" } },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("Aucun sortant ne correspond aux critères."),
    ).toBeInTheDocument();
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { [API]: jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement des sénatoriales",
    );
  },
};

export const Erreur: Story = {
  parameters: parametresEcran(PATH, { [API]: enErreur(500, API) }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("alert")).toBeInTheDocument();
    await expect(ecran.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
