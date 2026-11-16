import type { FixtureRoutes } from "@clair/api-client";
import type { PageVotes, ParlementaireDetail } from "@clair/data";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { amendementsCamille } from "../comparateur/fixtures.ts";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import { ficheExemple, ficheReponse, page, votesExemple } from "./fixtures.ts";
import { ParlementaireFicheScreen } from "./ParlementaireFicheScreen.tsx";

const SLUG = "camille-exemple";
const PATH = `/deputes/${SLUG}`;
const API = `/deputes/${SLUG}`;

/** Une prise de parole fictive, reprise du test de l'écran. */
const seance = (seanceId: string, date: string, contenu: string) => ({
  seanceId,
  date,
  interventions: [
    {
      id: `${seanceId}-1`,
      date,
      type: "intervention",
      contenu,
      hasMore: false,
      motsCles: [],
      sourceUrl: null,
      ordre: 1,
      articleVise: null,
      dossier: null,
      scrutinIds: [],
    },
  ],
  scrutins: [],
  ordreDuJour: [],
});

const seancesExemple = page([
  seance("RUANR5L17S2025IDS99998", "2025-03-05T15:00:00.000Z", "Première prise de parole fictive."),
  seance("RUANR5L17S2025IDS99997", "2025-03-04T15:00:00.000Z", "Seconde prise de parole fictive."),
]);

const routes: FixtureRoutes = {
  [API]: ficheReponse,
  [`${API}/votes`]: votesExemple,
  [`${API}/amendements`]: amendementsCamille,
  [`${API}/interventions`]: seancesExemple,
};
const navigate = fn();

// La même élue fictive, placée au Sénat.
const ficheSenat: ParlementaireDetail = {
  ...ficheExemple,
  chambre: "senat",
  groupe: ficheExemple.groupe ? { ...ficheExemple.groupe, chambre: "senat" } : null,
  mandatsParlementaires: ficheExemple.mandatsParlementaires.map((mandat) => ({
    ...mandat,
    chambre: "senat",
    legislature: null,
  })),
};
const votesSenat: PageVotes = {
  ...votesExemple,
  data: votesExemple.data.map((vote) => ({
    ...vote,
    scrutin: { ...vote.scrutin, chambre: "senat", session: "2025" },
  })),
};

const meta = {
  title: "Écrans/Fiche d'un parlementaire",
  component: ParlementaireFicheScreen,
  args: { chambre: "assemblee", slug: SLUG, params: {} },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, routes, navigate),
    docs: {
      description: {
        component:
          "Routes `/deputes/[slug]` et `/senateurs/[slug]`. En-tête, statistiques calculées par CLAIR, synthèse générée par IA, puis onglets votes, amendements, interventions, mandats et déclarations HATVP. Onglet et filtres dans l'URL. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof ParlementaireFicheScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Camille Exemple",
    );
    await expect(ecran.getByRole("tab", { name: "Votes", selected: true })).toBeInTheDocument();
    await expect(
      await ecran.findByRole("link", { name: "L'ensemble du projet de loi exemple" }),
    ).toHaveAttribute("href", "/scrutins/42?chambre=assemblee&session=17");
    await userEvent.click(
      ecran.getByLabelText("Uniquement les votes différents de la position du groupe"),
    );
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?dissidents=1`);
    await userEvent.click(ecran.getByRole("tab", { name: /Déclarations HATVP/ }));
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?onglet=declarations`);
  },
};

export const Amendements: Story = {
  args: { params: { onglet: "amendements" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(
      await ecran.findByRole("tab", { name: /Amendements/, selected: true }),
    ).toBeInTheDocument();
    await expect(
      (await ecran.findAllByRole("heading", { name: /Amendement n°/ })).length,
    ).toBeGreaterThan(0);
  },
};

export const Interventions: Story = {
  args: { params: { onglet: "interventions" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    const seconde = await ecran.findByRole("button", { name: /^Afficher les prises de parole/ });
    await expect(seconde).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(seconde);
    await expect(seconde).toHaveAttribute("aria-expanded", "true");
    await expect(ecran.getByText("Seconde prise de parole fictive.")).toBeVisible();
    await userEvent.selectOptions(ecran.getByLabelText("Nature des prises de parole"), "question");
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?onglet=interventions&type=question`);
  },
};

export const Mandats: Story = {
  args: { params: { onglet: "mandats" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(
      await ecran.findByRole("tab", { name: /Mandats/, selected: true }),
    ).toBeInTheDocument();
    // L'aperçu hors des onglets cite aussi la commission : on la cherche dans l'onglet.
    const onglet = within(await ecran.findByRole("tabpanel"));
    await expect(await onglet.findByText(/Commission des exemples/)).toBeInTheDocument();
  },
};

export const Declarations: Story = {
  args: { params: { onglet: "declarations" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(
      await ecran.findByRole("link", { name: /Consulter sur hatvp.fr/ }),
    ).toBeInTheDocument();
    await expect(
      ecran.getByRole("heading", { name: "Déclaration d'intérêts et d'activités" }),
    ).toBeInTheDocument();
  },
};

export const Senateur: Story = {
  args: { chambre: "senat" },
  parameters: parametresEcran(`/senateurs/${SLUG}`, {
    [`/senateurs/${SLUG}`]: { data: ficheSenat },
    [`/senateurs/${SLUG}/votes`]: votesSenat,
  }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Camille Exemple",
    );
    await expect(
      await ecran.findByRole("link", { name: "L'ensemble du projet de loi exemple" }),
    ).toHaveAttribute("href", "/scrutins/42?chambre=senat&session=2025");
  },
};

export const SenateurMandats: Story = {
  args: { chambre: "senat", params: { onglet: "mandats" } },
  parameters: Senateur.parameters,
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("tab", { name: /Mandats/, selected: true }),
    ).toBeInTheDocument();
  },
};

export const OngletVide: Story = {
  args: { params: { onglet: "amendements" } },
  parameters: parametresEcran(PATH, { ...routes, [`${API}/amendements`]: page([]) }),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("Aucun amendement trouvé pour ces critères."),
    ).toBeInTheDocument();
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { ...routes, [API]: jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement de la fiche",
    );
  },
};

export const Erreur: Story = {
  parameters: parametresEcran(PATH, { ...routes, [API]: enErreur(500, API) }),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole("alert")).toHaveTextContent(
      "Le chargement a échoué",
    );
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
