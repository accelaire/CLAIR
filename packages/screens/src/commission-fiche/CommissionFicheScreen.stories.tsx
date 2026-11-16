import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import { CommissionFicheScreen } from "./CommissionFicheScreen.tsx";
import {
  commissionDetailExemple,
  commissionHemicycle,
  detail,
  dossierCommissionExemple,
  pageDossiersCommission,
  pageReunions,
  reunionExemple,
} from "./fixtures.ts";

const SLUG = "assemblee-commission-des-jardins-partages";
const PATH = `/commissions/${SLUG}`;
const routes = {
  [PATH]: detail(commissionDetailExemple),
  [`${PATH}/reunions`]: pageReunions([reunionExemple], 2),
  [`${PATH}/dossiers`]: pageDossiersCommission([dossierCommissionExemple]),
};
const navigate = fn();

const meta = {
  title: "Écrans/Fiche d'une commission",
  component: CommissionFicheScreen,
  args: { slug: SLUG, params: {} },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, routes, navigate),
    docs: {
      description: {
        component:
          "Route `/commissions/[slug]`. En-tête de l'organe, puis onglets : membres, agenda, historique des réunions et textes saisis. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof CommissionFicheScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Commission des jardins partagés",
    );
    await expect(ecran.queryByRole("link", { name: /Alex Ancien/ })).not.toBeInTheDocument();
    await userEvent.click(ecran.getByRole("button", { name: /anciens membres/ }));
    await expect(ecran.getByRole("link", { name: /Alex Ancien/ })).toBeInTheDocument();
    await userEvent.click(ecran.getByRole("tab", { name: /Historique/ }));
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?tab=historique`);
  },
};

export const Historique: Story = {
  args: { params: { tab: "historique" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("link", { name: /mardi 3 mars 2026/ })).toHaveAttribute(
      "href",
      "/reunions/RUANREXEMPLE1",
    );
    await userEvent.click(ecran.getByRole("button", { name: /Voir l'autre point/ }));
    await expect(ecran.getByText("Questions diverses")).toBeInTheDocument();
    await expect(ecran.getByRole("link", { name: /Suivant/ })).toHaveAttribute(
      "href",
      `${PATH}?tab=historique&page=2`,
    );
  },
};

export const Textes: Story = {
  args: { params: { tab: "dossiers" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("link", { name: /potagers/ })).toHaveAttribute(
      "href",
      "/dossiers/DLEXEMPLE9",
    );
    await userEvent.selectOptions(ecran.getByLabelText("Rôle de la commission"), "avis");
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?tab=dossiers&role=avis`);
  },
};

export const AgendaVide: Story = {
  args: { params: { tab: "agenda" } },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("Aucune réunion à venir enregistrée"),
    ).toBeInTheDocument();
  },
};

export const Hemicycle: Story = {
  parameters: parametresEcran(PATH, { ...routes, [PATH]: detail(commissionHemicycle) }),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("tab", { name: "Prochaines séances" }),
    ).toBeInTheDocument();
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { ...routes, [PATH]: jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement de la commission",
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
    await expect(
      await within(canvasElement).findByText("Commission introuvable"),
    ).toBeInTheDocument();
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
