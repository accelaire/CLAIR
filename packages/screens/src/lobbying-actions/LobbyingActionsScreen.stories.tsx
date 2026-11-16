import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import {
  actionExemple,
  actionExemple2,
  lobbyisteExemple,
  pageActions,
  secteursExemple,
} from "../lobbying-liste/fixtures.ts";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import { LobbyingActionsScreen } from "./LobbyingActionsScreen.tsx";

const PATH = "/lobbying/actions";
const routes = {
  [PATH]: pageActions([actionExemple, actionExemple2], { totalPages: 2 }),
  "/lobbying/secteurs": secteursExemple,
};
const navigate = fn();

const meta = {
  title: "Écrans/Actions de lobbying",
  component: LobbyingActionsScreen,
  args: { params: {} },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, routes, navigate),
    docs: {
      description: {
        component:
          "Route `/lobbying/actions`. Actions déclarées par les représentants d'intérêts, filtrables par cible, texte visé, secteur et période, triées et paginées. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof LobbyingActionsScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent("Actions de lobbying");
    await expect(
      await ecran.findByRole("heading", {
        level: 2,
        name: "Présenter nos propositions sur les jardins partagés",
      }),
    ).toBeInTheDocument();
    await expect(ecran.getAllByRole("link", { name: lobbyisteExemple.nom })[0]).toHaveAttribute(
      "href",
      `/lobbying/${lobbyisteExemple.id}`,
    );
    await expect(ecran.getByRole("link", { name: /Suivant/ })).toHaveAttribute(
      "href",
      `${PATH}?page=2`,
    );
    await userEvent.selectOptions(ecran.getByLabelText("Cible"), "ministre");
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?cible=ministre`);
    await userEvent.selectOptions(ecran.getByLabelText("Trier par"), "lobbyiste-asc");
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?sort=lobbyiste&order=asc`);
  },
};

export const Periode: Story = {
  args: { params: { dateFrom: "2026-01-01", page: "2" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await userEvent.selectOptions(ecran.getByLabelText("Texte visé"), "Actes réglementaires");
    await expect(navigate).toHaveBeenCalledWith(
      `${PATH}?texteVise=Actes+r%C3%A9glementaires&dateFrom=2026-01-01`,
    );
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { ...routes, [PATH]: jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement des actions",
    );
  },
};

export const Vide: Story = {
  args: { params: { cible: "presidence", search: "x" } },
  parameters: parametresEcran(
    PATH,
    { ...routes, [PATH]: pageActions([], { totalPages: 0 }) },
    navigate,
  ),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByText("Aucune action trouvée")).toBeInTheDocument();
    await userEvent.click(ecran.getByRole("button", { name: "Effacer les filtres" }));
    await expect(navigate).toHaveBeenCalledWith(PATH);
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
