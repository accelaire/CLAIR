import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import { pageScrutins, scrutinsExemples } from "./fixtures.ts";
import { ScrutinsListeScreen } from "./ScrutinsListeScreen.tsx";

const PATH = "/scrutins";
const routes = {
  "/scrutins": pageScrutins(scrutinsExemples, { totalPages: 3, total: 50 }),
  "/scrutins/tags": { data: [{ name: "environnement", count: 4 }] },
  "/scrutins/periodes": { data: [] },
  "/dossiers/trending": { data: [] },
};
const navigate = fn();

const meta = {
  title: "Écrans/Liste des scrutins",
  component: ScrutinsListeScreen,
  args: { params: {} },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, routes, navigate),
    docs: {
      description: {
        component:
          "Route `/scrutins`. Liste paginée des scrutins des deux chambres, avec recherche et filtres (chambre, mode de scrutin, objet du vote, motions de censure, thématique, période) écrits dans l'URL. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof ScrutinsListeScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("heading", { level: 1 })).toHaveTextContent("Scrutins");
    await expect(
      await ecran.findByRole("link", { name: /L'amendement d'exemple n° 3/ }),
    ).toHaveAttribute("href", "/scrutins/12?chambre=senat&session=2025");
    await expect(ecran.getByRole("link", { name: "Page 2" })).toHaveAttribute(
      "href",
      "/scrutins?page=2",
    );
    await userEvent.selectOptions(await ecran.findByLabelText("Objet du vote"), "ensemble");
    await expect(navigate).toHaveBeenCalledWith("/scrutins?nature=ensemble");
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { ...routes, "/scrutins": jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement des scrutins",
    );
  },
};

export const Vide: Story = {
  args: { params: { nature: "amendement" } },
  parameters: parametresEcran(PATH, { ...routes, "/scrutins": pageScrutins([]) }, navigate),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByText("Aucun scrutin trouvé")).toBeInTheDocument();
    await userEvent.click(ecran.getByRole("button", { name: "Effacer les filtres" }));
    await expect(navigate).toHaveBeenCalledWith("/scrutins");
  },
};

export const Erreur: Story = {
  parameters: parametresEcran(PATH, { ...routes, "/scrutins": enErreur(500, PATH) }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("alert")).toHaveTextContent("Le chargement a échoué");
    await expect(ecran.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  },
};

/** Filtre des motions de censure en réponse à un 49.3, lu depuis l'URL. */
export const MotionsDeCensure: Story = {
  args: { params: { censure: "alinea3" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByLabelText("Motions de censure")).toHaveValue("alinea3");
    await expect(
      ecran.getByRole("button", { name: /Motions de censure : En réponse à un 49\.3/ }),
    ).toBeInTheDocument();
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
