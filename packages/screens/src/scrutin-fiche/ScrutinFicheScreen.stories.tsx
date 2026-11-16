import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { motionAdopteeExemple } from "../shared/contexte-gouvernemental/fixtures.ts";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import { interventionsExemple, scrutinDetailExemple } from "./fixtures.ts";
import { ScrutinFicheScreen } from "./ScrutinFicheScreen.tsx";

const PATH = "/scrutins/101";
const routes = {
  [PATH]: { data: scrutinDetailExemple() },
  [`${PATH}/interventions`]: interventionsExemple,
};
const navigate = fn();

const meta = {
  title: "Écrans/Fiche d'un scrutin",
  component: ScrutinFicheScreen,
  args: { numero: 101, params: { chambre: "assemblee", session: "17" } },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, routes, navigate),
    docs: {
      description: {
        component:
          "Route `/scrutins/[numero]`. Objet du vote, dossier, résumé généré par IA (signalé), résultat officiel, puis trois onglets dans l'URL : amendements mis aux voix, débats et vote par groupe et par élu. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof ScrutinFicheScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Onglet par défaut : les amendements mis aux voix. */
export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("heading", { level: 1 })).toHaveTextContent(
      "L'amendement d'exemple n° 7",
    );
    await expect(ecran.getByRole("tab", { name: /Amendements/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(ecran.getByRole("heading", { name: "Amendement n° 7" })).toBeInTheDocument();
    await userEvent.click(ecran.getByRole("tab", { name: /Vote/ }));
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?chambre=assemblee&session=17&onglet=vote`);
  },
};

export const Debats: Story = {
  args: { params: { chambre: "assemblee", session: "17", onglet: "debats" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByText(/cette prise de parole est inventée/)).toBeInTheDocument();
    await expect(await ecran.findByText("Défense de l'amendement n° 7")).toBeInTheDocument();
  },
};

export const Vote: Story = {
  args: { params: { chambre: "assemblee", session: "17", onglet: "vote", groupe: "GPB" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    const tableau = await ecran.findByRole("table");
    await expect(within(tableau).getAllByRole("row")).toHaveLength(3);
    await expect(ecran.getByRole("link", { name: "Alex Fictif" })).toHaveAttribute(
      "href",
      "/deputes/alex-fictif",
    );
    await userEvent.selectOptions(ecran.getByLabelText("Position"), "contre");
    await expect(navigate).toHaveBeenCalledWith(
      `${PATH}?chambre=assemblee&session=17&onglet=vote&groupe=GPB&position=contre`,
    );
  },
};

export const MotionDeCensure: Story = {
  parameters: parametresEcran(PATH, {
    ...routes,
    [PATH]: { data: scrutinDetailExemple({ motionCensure: motionAdopteeExemple }) },
  }),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("heading", {
        name: /Motion de censure · article 49, alinéa 3/,
      }),
    ).toBeInTheDocument();
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { [PATH]: jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement du scrutin",
    );
  },
};

export const Erreur: Story = {
  parameters: parametresEcran(PATH, { [PATH]: enErreur(500, PATH) }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("alert")).toBeInTheDocument();
    await expect(ecran.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  },
};

export const Introuvable: Story = {
  parameters: parametresEcran(PATH, { [PATH]: enErreur(404, PATH) }),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("Scrutin introuvable")).toBeInTheDocument();
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
