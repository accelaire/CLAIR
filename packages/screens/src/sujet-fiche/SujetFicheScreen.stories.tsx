import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { contexteGouvernementalExemple } from "../shared/contexte-gouvernemental/fixtures.ts";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import { routesSujetExemple, SLUG_EXEMPLE, sujetExemple } from "./fixtures.ts";
import { SujetFicheScreen } from "./SujetFicheScreen.tsx";

const PATH = `/sujets/${SLUG_EXEMPLE}`;
const navigate = fn();

/** Huit groupes fictifs, pour le bouton qui montre les groupes au-delà des six premiers. */
const huitGroupes = Array.from({ length: 8 }, (_, i) => ({
  nom: `EX${i}`,
  slug: `ex${i}`,
  couleur: null,
  chambre: "assemblee" as const,
  votes: { pour: 1, contre: 0, abstention: 0, absent: 0 },
  amendements: 8 - i,
}));

const meta = {
  title: "Écrans/Fiche d'un sujet",
  component: SujetFicheScreen,
  args: { slug: SLUG_EXEMPLE, params: {} },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, routesSujetExemple, navigate),
    docs: {
      description: {
        component:
          "Route `/sujets/[slug]`. Un grand texte suivi de bout en bout : statut, résumé généré par IA (signalé), parcours législatif, scrutins filtrables, positions des groupes calculées par CLAIR (signalées) et dossiers liés. Filtres dans l'URL. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof SujetFicheScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("heading", { level: 1 })).toHaveTextContent(
      sujetExemple.label,
    );
    await expect(await ecran.findByText(/Calculée par CLAIR/)).toBeInTheDocument();
    await expect(
      await ecran.findByRole("link", { name: /l'ensemble de la proposition de loi/ }),
    ).toHaveAttribute("href", "/scrutins/42?chambre=senat&session=2025");
    const chambre = await ecran.findByRole("group", { name: "Chambre" });
    await userEvent.click(within(chambre).getByRole("radio", { name: "Sénat" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(`${PATH}?chambre=senat`));
  },
};

/** Plus de six groupes : les autres se déplient d'un clic. */
export const GroupesDeplies: Story = {
  parameters: parametresEcran(PATH, {
    ...routesSujetExemple,
    [`${PATH}/stats`]: { data: huitGroupes, groupeAmendementDescriptions: {} },
  }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    const bouton = await ecran.findByRole("button", { name: "Afficher les 2 autres groupes" });
    await expect(bouton).toHaveAttribute("aria-expanded", "false");
    await expect(ecran.queryByText("EX7")).toBeNull();
    await userEvent.click(bouton);
    await expect(bouton).toHaveAttribute("aria-expanded", "true");
    await expect(ecran.getByRole("region", { name: "Groupes politiques" })).toHaveTextContent(
      "EX7",
    );
  },
};

/** Texte du Gouvernement : encadré « Le Gouvernement et ce texte ». */
export const AvecGouvernement: Story = {
  parameters: parametresEcran(PATH, {
    ...routesSujetExemple,
    [PATH]: { data: { ...sujetExemple, gouvernement: contexteGouvernementalExemple } },
  }),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("region", { name: "Le Gouvernement et ce texte" }),
    ).toBeInTheDocument();
  },
};

/** Filtre de chambre sans scrutin correspondant. */
export const Vide: Story = {
  args: { params: { chambre: "assemblee" } },
  parameters: parametresEcran(PATH, {
    ...routesSujetExemple,
    [`${PATH}/scrutins`]: {
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false },
    },
  }),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("Aucun scrutin ne correspond à ces filtres."),
    ).toBeInTheDocument();
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { [PATH]: jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement du sujet",
    );
  },
};

export const Erreur: Story = {
  parameters: parametresEcran(PATH, { [PATH]: enErreur(500, PATH) }),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("button", { name: "Réessayer" }),
    ).toBeInTheDocument();
  },
};

export const Introuvable: Story = {
  parameters: parametresEcran(PATH, { [PATH]: enErreur(404, PATH) }),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole("heading", { level: 1 })).toHaveTextContent(
      "Page introuvable",
    );
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
