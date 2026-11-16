import type { DirectsDuJour } from "@clair/data";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import { AgendaScreen } from "./AgendaScreen.tsx";
import { agendaExemple, reunionAgendaExemple } from "./fixtures.ts";
import { jourParis } from "./params.ts";

const PATH = "/agenda";
const AUJOURDHUI = "2026-03-03";
const routes = { [PATH]: agendaExemple() };
const navigate = fn();

/**
 * Réunion fictive en cours au moment où la story s'affiche : « En direct » dépend de l'heure
 * réelle du navigateur, la réunion est donc placée autour de maintenant.
 */
const maintenant = Date.now();
const aujourdhuiReel = jourParis(new Date(maintenant));
const reunionEnCours = {
  ...reunionAgendaExemple,
  id: "agenda-reunion-en-cours",
  dateDebut: new Date(maintenant - 30 * 60 * 1000).toISOString(),
  dateFin: new Date(maintenant + 60 * 60 * 1000).toISOString(),
};
const DIRECT = "https://video.exemple.test/direct-commission";
const directsExemple: DirectsDuJour = {
  commissions: [{ organeRef: "POEXEMPLE1", directUrl: DIRECT, chambre: "assemblee" }],
  seances: [],
};

const meta = {
  title: "Écrans/Agenda",
  component: AgendaScreen,
  args: { aujourdhui: AUJOURDHUI, params: {} },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, routes, navigate),
    docs: {
      description: {
        component:
          "Route `/agenda`. Calendrier du mois (réunions de commission, séances publiques, repères institutionnels) et détail du jour choisi, avec le lien du direct d'une réunion en cours. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof AgendaScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Agenda parlementaire",
    );
    const jour = await ecran.findByRole("button", { name: /mardi 3 mars, 2 réunions/ });
    await expect(jour).toHaveAttribute("aria-pressed", "true");
    const reunions = await ecran.findByRole("list", { name: "Réunions du jour" });
    await expect(within(reunions).getByRole("link", { name: "Séance publique" })).toHaveAttribute(
      "href",
      "/reunions/RUSNREXEMPLE3",
    );
    await userEvent.click(ecran.getByRole("button", { name: /mardi 10 mars/ }));
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?date=2026-03-10`);
    await userEvent.click(ecran.getByRole("button", { name: "Mois suivant" }));
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?mois=2026-04`);
  },
};

export const Evenements: Story = {
  args: { params: { date: "2026-03-10" } },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("heading", {
        level: 3,
        name: "Ouverture d'une session d'exemple",
      }),
    ).toBeInTheDocument();
  },
};

export const FiltreType: Story = {
  args: { params: { date: "2026-03-03" } },
  play: async ({ canvasElement }) => {
    await userEvent.selectOptions(within(canvasElement).getByLabelText("Type"), "seance");
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?date=2026-03-03&type=seance`);
  },
};

export const EnDirect: Story = {
  args: { aujourdhui: aujourdhuiReel },
  parameters: parametresEcran(PATH, {
    [PATH]: agendaExemple({ [aujourdhuiReel]: [reunionEnCours] }, []),
    [`${PATH}/direct`]: directsExemple,
  }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByText("En direct")).toBeInTheDocument();
    await expect(await ecran.findByRole("link", { name: /Suivre en direct/ })).toHaveAttribute(
      "href",
      DIRECT,
    );
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { [PATH]: jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement de l'agenda",
    );
  },
};

export const Vide: Story = {
  args: { params: { date: "2026-03-04" } },
  parameters: parametresEcran(PATH, { [PATH]: agendaExemple({}, []) }),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("Aucune réunion ce jour"),
    ).toBeInTheDocument();
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

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
