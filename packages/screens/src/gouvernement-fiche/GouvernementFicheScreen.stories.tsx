import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import { gouvernementAncienFictif, reponseFictive } from "./fixtures.ts";
import { GouvernementFicheScreen } from "./GouvernementFicheScreen.tsx";

const SLUG = "fictif-ii";
const PATH = `/gouvernements/${SLUG}`;
const API = `/gouvernements/${SLUG}`;
// Le 1er novembre 2026 à midi, heure de Paris : des durées stables d'un rendu à l'autre.
const MAINTENANT = Date.parse("2026-11-01T11:00:00Z");
const navigate = fn();

const meta = {
  title: "Écrans/Fiche d'un gouvernement",
  component: GouvernementFicheScreen,
  args: { slug: SLUG, params: {}, maintenant: MAINTENANT },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, { [API]: reponseFictive() }, navigate),
    docs: {
      description: {
        component:
          "Route `/gouvernements/[slug]`. En-tête, colonne de faits, composition par étape, textes portés, 49.3 et motions de censure, tous les postes. Onglet et étape dans l'URL. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof GouvernementFicheScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Gouvernement Fictif II",
    );
    await expect(ecran.getByRole("heading", { name: "Composition actuelle" })).toBeInTheDocument();
    await userEvent.click(ecran.getByRole("tab", { name: /Tous les postes/ }));
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?onglet=postes`);
  },
};

export const EtapeNomination: Story = {
  args: { params: { etape: "2025-09-20" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(
      await ecran.findByRole("heading", { name: "Composition à la nomination" }),
    ).toBeInTheDocument();
    await userEvent.click(ecran.getByRole("button", { name: /Revenir à la composition actuelle/ }));
    await expect(navigate).toHaveBeenCalledWith(PATH);
  },
};

export const TextesPortes: Story = {
  args: { params: { onglet: "textes" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("tab", { name: /Textes portés/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(ecran.getByText("promulgué")).toBeInTheDocument();
  },
};

export const Censure: Story = {
  args: { params: { onglet: "censure" } },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/250 voix pour, 289 requises/),
    ).toBeInTheDocument();
  },
};

export const TousLesPostes: Story = {
  args: { params: { onglet: "postes" } },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("tab", { name: /Tous les postes/ }),
    ).toHaveAttribute("aria-selected", "true");
  },
};

export const AvantJuin2017: Story = {
  args: { slug: gouvernementAncienFictif.slug },
  parameters: parametresEcran(`/gouvernements/${gouvernementAncienFictif.slug}`, {
    [`/gouvernements/${gouvernementAncienFictif.slug}`]: reponseFictive(gouvernementAncienFictif),
  }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(
      await ecran.findByText("Pas de données de bilan avant juin 2017."),
    ).toBeInTheDocument();
    await expect(ecran.queryByRole("tab", { name: /Textes portés/ })).toBeNull();
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { [API]: jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement du gouvernement",
    );
  },
};

export const Erreur: Story = {
  parameters: parametresEcran(PATH, { [API]: enErreur(500, API) }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("alert")).toBeInTheDocument();
    await expect(ecran.getByRole("button", { name: /Réessayer/ })).toBeInTheDocument();
  },
};

export const Introuvable: Story = {
  parameters: parametresEcran(PATH, { [API]: enErreur(404, API) }),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("Gouvernement introuvable"),
    ).toBeInTheDocument();
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
