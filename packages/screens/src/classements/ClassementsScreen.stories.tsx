import type { Query } from "@clair/api-client";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import { ClassementsScreen } from "./ClassementsScreen.tsx";
import { groupeClasse, pageClassement, parlementaireClasse } from "./fixtures.ts";

const PATH = "/classements";
const API = "/parlementaires";
const tous = [1, 2, 3].map((id) => parlementaireClasse(id));

const routes = (items = tous) => ({
  [API]: (query: Query) =>
    query.order === "asc"
      ? pageClassement([...items].reverse())
      : pageClassement(items, { totalPages: 3 }),
  "/parlementaires/groupes": { data: [] },
  "/parlementaires/historique-carriere": { data: { present: false } },
  "/groupes": { data: [groupeClasse(1, 50), groupeClasse(2, 70)] },
});
const navigate = fn();

const meta = {
  title: "Écrans/Classements",
  component: ClassementsScreen,
  args: { params: {} },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, routes(), navigate),
    docs: {
      description: {
        component:
          "Route `/classements`. Classement des parlementaires (top, flop, tableau trié et paginé) et des groupes, par chambre et par critère calculé par CLAIR. Tout l'état vit dans l'URL. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof ClassementsScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Classements parlementaires",
    );
    const tableau = await ecran.findByRole("table", { name: /Classement des parlementaires/ });
    await expect(within(tableau).getByRole("link", { name: "Camille Exemple1" })).toHaveAttribute(
      "href",
      "/deputes/personne-exemple-1",
    );
    await userEvent.click(within(tableau).getByRole("button", { name: /Loyauté/ }));
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?sort=loyaute`);
  },
};

export const ChangerDeChambre: Story = {
  args: { params: { groupe: "gex" } },
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("radio", { name: "Sénat" }));
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?chambre=senat`);
  },
};

export const Groupes: Story = {
  args: { params: { tab: "groupes" } },
  play: async ({ canvasElement }) => {
    const tableau = await within(canvasElement).findByRole("table", {
      name: /groupes politiques par présence/,
    });
    const lignes = within(tableau).getAllByRole("row");
    await expect(lignes[1]).toHaveTextContent("Groupe d'exemple numéro 2");
  },
};

export const MisEnAvant: Story = {
  args: { params: { highlight: "personne-exemple-2" } },
  parameters: parametresEcran(PATH, {
    ...routes(),
    "/parlementaires/personne-exemple-2/rank": { data: { rank: 120, total: 300 } },
    [API]: () => pageClassement(tous, { page: 3, totalPages: 6 }),
  }),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("Mis en avant")).toBeInTheDocument();
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { ...routes(), [API]: jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement du classement",
    );
  },
};

export const Vide: Story = {
  args: { params: { groupe: "gex" } },
  parameters: parametresEcran(PATH, routes([])),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("Aucun parlementaire ne correspond à ces filtres"),
    ).toBeInTheDocument();
  },
};

export const Erreur: Story = {
  parameters: parametresEcran(PATH, { ...routes(), [API]: enErreur(500, API) }),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("button", { name: "Réessayer" }),
    ).toBeInTheDocument();
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
