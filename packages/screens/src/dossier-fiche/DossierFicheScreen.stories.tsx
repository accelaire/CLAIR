import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { contexteGouvernementalExemple } from "../shared/contexte-gouvernemental/fixtures.ts";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import { DossierFicheScreen } from "./DossierFicheScreen.tsx";
import {
  amendementExemple,
  dossierDetailExemple,
  etapeExemple,
  page,
  scrutinExemple,
} from "./fixtures.ts";

const PATH = "/dossiers/DLEXEMPLE1";
const routes = {
  [PATH]: dossierDetailExemple,
  [`${PATH}/chronologie`]: { data: [etapeExemple] },
  [`${PATH}/scrutins`]: page([scrutinExemple]),
  [`${PATH}/amendements`]: page([amendementExemple]),
};
const navigate = fn();

const meta = {
  title: "Écrans/Fiche d'un dossier législatif",
  component: DossierFicheScreen,
  args: { uid: "DLEXEMPLE1", params: {} },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, routes, navigate),
    docs: {
      description: {
        component:
          "Route `/dossiers/[uid]`. Titre, résumé généré par IA (signalé), commission, contexte gouvernemental, puis trois onglets dans l'URL : parcours (votes de chaque étape repliés), amendements et scrutins. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof DossierFicheScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Onglet par défaut : le parcours ; les votes d'une étape se déplient. */
export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Proposition de loi ordinaire relative aux jardins partagés",
    );
    await expect(ecran.getByRole("tab", { name: /Parcours/, selected: true })).toBeInTheDocument();
    await userEvent.click(ecran.getByRole("tab", { name: /Scrutins/ }));
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?tab=scrutins`);
  },
};

/** Les votes d'une étape du parcours, dépliés d'un clic. */
export const VotesDepliesDuParcours: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    const bascule = await ecran.findByRole("button", { name: /^1 vote de l'étape du/ });
    await expect(bascule).toHaveAttribute("aria-expanded", "false");
    await expect(
      ecran.queryByRole("link", { name: /Scrutin n° 42 : Scrutin d'exemple/ }),
    ).toBeNull();
    await userEvent.click(bascule);
    await expect(bascule).toHaveAttribute("aria-expanded", "true");
    await expect(
      await ecran.findByRole("link", { name: /Scrutin n° 42 : Scrutin d'exemple/ }),
    ).toHaveAttribute("href", "/scrutins/42?chambre=senat&session=2025");
  },
};

export const Amendements: Story = {
  args: { params: { tab: "amendements" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(
      await ecran.findByRole("heading", { name: "Amendement n° 7" }),
    ).toBeInTheDocument();
    await userEvent.selectOptions(
      await ecran.findByLabelText("Groupe de l'auteur"),
      "groupe-exemple",
    );
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?tab=amendements&groupe=groupe-exemple`);
  },
};

export const Scrutins: Story = {
  args: { params: { tab: "scrutins" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(
      await ecran.findByRole("tab", { name: /Scrutins/, selected: true }),
    ).toBeInTheDocument();
    await expect(
      await ecran.findByRole("link", { name: /Scrutin d'exemple sur l'ensemble/ }),
    ).toHaveAttribute("href", "/scrutins/42?chambre=senat&session=2025");
  },
};

/** Scrutins filtrables par objet du vote : puces avec décompte (liste déroulante sur mobile). */
export const ScrutinsParObjet: Story = {
  args: { params: { tab: "scrutins" } },
  globals: { viewport: { value: "xl" } },
  parameters: parametresEcran(
    PATH,
    { ...routes, [PATH]: { ...dossierDetailExemple, naturesCount: { ensemble: 1, article: 3 } } },
    navigate,
  ),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(
      await ecran.findByRole("tab", { name: /Scrutins/, selected: true }),
    ).toBeInTheDocument();
    const puces = await ecran.findByRole("group", { name: "Filtrer par objet du vote" });
    const tous = within(puces).getByRole("button", { name: /^Tous les votes/ });
    await expect(tous).toHaveAttribute("aria-pressed", "true");
    await expect(tous).toHaveTextContent(/Tous les votes\s*\(1\)/);
    await expect(within(puces).getByRole("button", { name: /^Article/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  },
};

/** Texte du Gouvernement : encadré « Le Gouvernement et ce texte ». */
export const AvecGouvernement: Story = {
  parameters: parametresEcran(PATH, {
    ...routes,
    [PATH]: { ...dossierDetailExemple, gouvernement: contexteGouvernementalExemple },
  }),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("region", { name: "Le Gouvernement et ce texte" }),
    ).toBeInTheDocument();
  },
};

/** Sans parcours ni amendement : l'onglet des scrutins, vide. */
export const Vide: Story = {
  parameters: parametresEcran(PATH, {
    ...routes,
    [PATH]: { ...dossierDetailExemple, amendementsCount: 0, scrutins: [], scrutinsCount: 0 },
    [`${PATH}/chronologie`]: { data: [] },
    [`${PATH}/scrutins`]: page([]),
  }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByText("Aucun scrutin associé à ce dossier.")).toBeInTheDocument();
    await expect(ecran.queryByRole("tab", { name: /Amendements/ })).toBeNull();
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { [PATH]: jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement du dossier",
    );
  },
};

export const Erreur: Story = {
  parameters: parametresEcran(PATH, { [PATH]: enErreur(500, PATH) }),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole("alert")).toHaveTextContent(
      "Le chargement a échoué",
    );
  },
};

export const Introuvable: Story = {
  parameters: parametresEcran(PATH, { [PATH]: enErreur(404, PATH) }),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("Dossier législatif introuvable"),
    ).toBeInTheDocument();
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
