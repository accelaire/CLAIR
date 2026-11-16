import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import { DossiersListeScreen } from "./DossiersListeScreen.tsx";
import { dossierExemple, dossierExempleSenat, filtresDossiers, pageDossiers } from "./fixtures.ts";

const PATH = "/dossiers";
const routes = {
  "/dossiers": pageDossiers([dossierExemple, dossierExempleSenat], { totalPages: 3 }),
  "/dossiers/filters": filtresDossiers,
};
const navigate = fn();

const meta = {
  title: "Écrans/Liste des dossiers législatifs",
  component: DossiersListeScreen,
  args: { params: {} },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, routes, navigate),
    docs: {
      description: {
        component:
          "Route `/dossiers`. Liste paginée des dossiers législatifs, avec recherche et filtres (chambre, état, origine du texte, procédure, date de dépôt) écrits dans l'URL. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof DossiersListeScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  args: { params: { chambre: "senat", page: "2" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Dossiers législatifs",
    );
    await expect(await ecran.findByRole("link", { name: /jardins partagés/ })).toHaveAttribute(
      "href",
      "/dossiers/DLEXEMPLE1",
    );
    await userEvent.selectOptions(await ecran.findByLabelText("État"), "promulgue");
    await expect(navigate).toHaveBeenCalledWith("/dossiers?etat=promulgue&chambre=senat");
  },
};

/** Filtre sur l'origine du texte : les textes passés au 49.3. */
export const Origine493: Story = {
  args: { params: { gouvernement: "49-3" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByLabelText("Origine du texte")).toHaveValue("49-3");
    await expect(
      ecran.getByRole("button", { name: /Origine du texte : Passés au 49\.3/ }),
    ).toBeInTheDocument();
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { ...routes, "/dossiers": jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement des dossiers",
    );
  },
};

export const Vide: Story = {
  args: { params: { etat: "rejete" } },
  parameters: parametresEcran(
    PATH,
    { ...routes, "/dossiers": pageDossiers([], { totalPages: 0 }) },
    navigate,
  ),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByText("Aucun dossier trouvé")).toBeInTheDocument();
    await userEvent.click(ecran.getByRole("button", { name: "Effacer les filtres" }));
    await expect(navigate).toHaveBeenCalledWith("/dossiers");
  },
};

export const Erreur: Story = {
  parameters: parametresEcran(PATH, { ...routes, "/dossiers": enErreur(500, PATH) }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("alert")).toHaveTextContent("Le chargement a échoué");
    await expect(ecran.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
