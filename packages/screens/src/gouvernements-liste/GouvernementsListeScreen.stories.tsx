import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import { gouvernementsFixture } from "./fixtures.ts";
import { GouvernementsListeScreen } from "./GouvernementsListeScreen.tsx";

const PATH = "/gouvernements";
const API = "/gouvernements";
// Le 1er novembre 2026 à midi, heure de Paris : des durées stables d'un rendu à l'autre.
const MAINTENANT = Date.parse("2026-11-01T11:00:00Z");

const meta = {
  title: "Écrans/Gouvernements",
  component: GouvernementsListeScreen,
  args: { maintenant: MAINTENANT },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, { [API]: gouvernementsFixture }),
    docs: {
      description: {
        component:
          "Route `/gouvernements`. Gouvernements depuis 2007, regroupés par présidence, avec leur durée comparée, leurs membres et leur bilan (49.3, motions de censure). La page n'a pas d'état d'URL. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof GouvernementsListeScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Gouvernements",
    );
    await expect(
      (await ecran.findAllByRole("heading", { level: 2 })).map((h) => h.textContent),
    ).toEqual(["Présidence d’Ariane Exemple", "Présidence de Bruno Modèle"]);
    const carte = ecran.getByRole("link", { name: "Gouvernement Fictif II" }).closest("li");
    if (!carte) throw new Error("carte absente");
    await expect(within(carte).getByText("En fonction")).toBeInTheDocument();
    await expect(carte).toHaveTextContent("2 recours au 49.3, 3 motions de censure");
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { [API]: jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement des gouvernements",
    );
  },
};

export const Vide: Story = {
  parameters: parametresEcran(PATH, { [API]: { ...gouvernementsFixture, data: [] } }),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("Aucun gouvernement enregistré"),
    ).toBeInTheDocument();
  },
};

const enPanne = fn(enErreur(500, API));

export const Erreur: Story = {
  parameters: parametresEcran(PATH, { [API]: enPanne }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("alert")).toBeInTheDocument();
    enPanne.mockClear();
    await userEvent.click(ecran.getByRole("button", { name: /Réessayer/ }));
    await expect(enPanne).toHaveBeenCalledTimes(1);
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
