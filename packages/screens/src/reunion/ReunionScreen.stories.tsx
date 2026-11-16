import type { DebatDeReunionPage } from "@clair/data";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import { debatExemple, detail, reunionDetailExemple, seanceExemple } from "./fixtures.ts";
import { PRISES_PAR_PAGE } from "./params.ts";
import { ReunionScreen } from "./ReunionScreen.tsx";

const UID = "RUANREXEMPLE1";
const PATH = `/reunions/${UID}`;
const API = `/agenda/${UID}`;
const routes = {
  [API]: detail(reunionDetailExemple),
  [`${API}/debat`]: debatExemple,
};

const SEANCE = "RUANRSEANCEEXEMPLE";
const routesSeance = {
  [`/agenda/${SEANCE}`]: detail(seanceExemple),
  [`/agenda/${SEANCE}/debat`]: debatExemple,
  "/scrutins/interventions/prise-1": {
    data: {
      id: "prise-1",
      contenu: "Début d'un propos d'exemple, et sa suite complète.",
      sourceUrl: null,
    },
  },
};

/** Débat fictif de 120 prises de parole : trois pages de cinquante. */
const TOTAL_LONG = 120;
const premierePrise = debatExemple.data[0];
const debatLong = (query: { page?: unknown }): DebatDeReunionPage => {
  const page = Number(query.page ?? 1);
  const debut = (page - 1) * PRISES_PAR_PAGE;
  const nombre = Math.min(PRISES_PAR_PAGE, TOTAL_LONG - debut);
  return {
    data: premierePrise
      ? Array.from({ length: nombre }, (_, index) => ({
          ...premierePrise,
          id: `prise-long-${debut + index + 1}`,
          ordre: debut + index + 1,
          hasMore: false,
          contenu: `Propos d'exemple n° ${debut + index + 1}.`,
        }))
      : [],
    meta: {
      total: TOTAL_LONG,
      page,
      limit: PRISES_PAR_PAGE,
      totalPages: Math.ceil(TOTAL_LONG / PRISES_PAR_PAGE),
      hasNext: debut + nombre < TOTAL_LONG,
    },
  };
};

const meta = {
  title: "Écrans/Réunion",
  component: ReunionScreen,
  args: { uid: UID, params: {} },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, routes),
    docs: {
      description: {
        component:
          "Route `/reunions/[uid]`. Réunion de commission ou séance publique : ordre du jour, sommaire, débat page par page avec les votes à leur place, avis sur les amendements et participants. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof ReunionScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Commission des jardins partagés",
    );
    await expect(ecran.getByRole("table", { name: /Avis de la commission/ })).toBeInTheDocument();
    await expect(
      await ecran.findByRole("heading", { name: /Débat : 2 prises de parole/ }),
    ).toBeInTheDocument();
  },
};

export const Seance: Story = {
  args: { uid: SEANCE, params: { vote: "scrutin-exemple-1", rang: "1" } },
  parameters: parametresEcran(`/reunions/${SEANCE}`, routesSeance),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Séance publique",
    );
    await expect(ecran.getByRole("complementary", { name: "Vote suivi" })).toHaveTextContent(
      "Vous suivez le scrutin n° 42",
    );
    const bouton = ecran.getByRole("button", { name: /Suite de la discussion/ });
    await userEvent.click(bouton);
    await expect(bouton).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(await ecran.findByRole("button", { name: "Lire la suite" }));
    await expect(await ecran.findByText(/et sa suite complète/)).toBeInTheDocument();
  },
};

export const DebatPagine: Story = {
  args: { params: { debat: "2" } },
  parameters: parametresEcran(PATH, {
    [API]: detail({ ...reunionDetailExemple, nbInterventions: TOTAL_LONG }),
    [`${API}/debat`]: debatLong,
  }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(
      await ecran.findByRole("heading", { name: /Débat : 120 prises de parole/ }),
    ).toBeInTheDocument();
    await expect(await ecran.findByText("Propos d'exemple n° 51.")).toBeInTheDocument();
    const pages = ecran.getByRole("navigation", { name: "Pages du débat" });
    await expect(within(pages).getByRole("link", { name: /Suivant/ })).toHaveAttribute(
      "href",
      `${PATH}?debat=3`,
    );
    await expect(within(pages).getByRole("link", { name: /Précédent/ })).toHaveAttribute(
      "href",
      PATH,
    );
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { [API]: jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement de la réunion",
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

export const Introuvable: Story = {
  parameters: parametresEcran(PATH, { [API]: enErreur(404, API) }),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("Réunion introuvable")).toBeInTheDocument();
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
