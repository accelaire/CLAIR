import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import {
  actionExemple,
  lobbyisteExemple,
  lobbyisteExemple2,
  pageLobbyistes,
  secteursExemple,
  statsExemple,
} from "./fixtures.ts";
import { LobbyingListeScreen } from "./LobbyingListeScreen.tsx";

const PATH = "/lobbying";
const routes = {
  [PATH]: pageLobbyistes([lobbyisteExemple, lobbyisteExemple2], { totalPages: 3 }),
  [`${PATH}/secteurs`]: secteursExemple,
  [`${PATH}/stats`]: statsExemple,
  [`${PATH}/actions/recent`]: { data: [actionExemple] },
};
const navigate = fn();

const meta = {
  title: "Écrans/Lobbying",
  component: LobbyingListeScreen,
  args: { params: {} },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, routes, navigate),
    docs: {
      description: {
        component:
          "Route `/lobbying`. Chiffres du répertoire des représentants d'intérêts, dernières actions déclarées, puis la liste filtrable et triée des représentants. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof LobbyingListeScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent("Lobbying");
    await expect(
      await ecran.findByRole("link", { name: "Cabinet Conseil Exemple" }),
    ).toHaveAttribute("href", `${PATH}/${lobbyisteExemple2.id}`);
    await expect(ecran.getByRole("link", { name: /Suivant/ })).toHaveAttribute(
      "href",
      `${PATH}?page=2`,
    );
    await userEvent.selectOptions(ecran.getByLabelText("Type"), "syndicat");
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?type=syndicat`);
    await userEvent.selectOptions(ecran.getByLabelText("Trier par"), "budget-desc");
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?sort=budget&order=desc`);
  },
};

export const FiltreSecteur: Story = {
  args: { params: { secteurs: "environnement", page: "2" } },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("link", { name: "Cabinet Conseil Exemple" }),
    ).toBeInTheDocument();
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { ...routes, [PATH]: jamais }),
  play: async ({ canvasElement }) => {
    // Les chiffres et les dernières actions ont aussi leur état de chargement.
    const statuts = within(canvasElement).getAllByRole("status");
    await expect(statuts.map((statut) => statut.textContent).join(" ")).toContain(
      "Chargement des représentants",
    );
  },
};

export const Vide: Story = {
  args: { params: { type: "syndicat", sort: "actions", order: "desc" } },
  parameters: parametresEcran(
    PATH,
    { ...routes, [PATH]: pageLobbyistes([], { totalPages: 0 }) },
    navigate,
  ),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(
      await ecran.findByText("Aucun représentant d'intérêts trouvé"),
    ).toBeInTheDocument();
    await userEvent.click(ecran.getByRole("button", { name: "Effacer les filtres" }));
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?sort=actions&order=desc`);
  },
};

export const Erreur: Story = {
  parameters: parametresEcran(PATH, { ...routes, [PATH]: enErreur(500, PATH) }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("alert")).toBeInTheDocument();
    await expect(ecran.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
