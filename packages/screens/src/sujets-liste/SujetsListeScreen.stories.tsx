import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import { pageSujets, sujetsExemple } from "./fixtures.ts";
import { SujetsListeScreen } from "./SujetsListeScreen.tsx";

const PATH = "/sujets";
const routes = { "/sujets": pageSujets(sujetsExemple) };
const navigate = fn();

const meta = {
  title: "Écrans/Liste des sujets",
  component: SujetsListeScreen,
  args: { params: {} },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, routes, navigate),
    docs: {
      description: {
        component:
          "Route `/sujets`. Les grands textes suivis de bout en bout, répartis en sections repliables (en cours de discussion, promulgués, rejetés), avec une recherche écrite dans l'URL. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof SujetsListeScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Sujets parlementaires",
    );
    await expect(
      await ecran.findByRole("button", { name: /En cours de discussion/ }),
    ).toHaveAttribute("aria-expanded", "true");
    const promulgues = ecran.getByRole("button", { name: /Promulgués/ });
    await expect(promulgues).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(promulgues);
    await expect(promulgues).toHaveAttribute("aria-expanded", "true");
    await userEvent.type(ecran.getByRole("searchbox", { name: "Rechercher un sujet" }), "jardins");
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/sujets?search=jardins"));
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { "/sujets": jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement des sujets",
    );
  },
};

export const Vide: Story = {
  args: { params: { search: "zzz" } },
  parameters: parametresEcran(PATH, { "/sujets": pageSujets([]) }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByText("Aucun sujet trouvé")).toBeInTheDocument();
    await expect(ecran.getByText("Essayez de modifier votre recherche.")).toBeInTheDocument();
  },
};

export const Erreur: Story = {
  parameters: parametresEcran(PATH, { "/sujets": enErreur(500, PATH) }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("alert")).toHaveTextContent("Le chargement a échoué");
    await expect(ecran.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
