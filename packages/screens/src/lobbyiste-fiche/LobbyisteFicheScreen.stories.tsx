import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { lobbyisteDetailExemple } from "../lobbying-liste/fixtures.ts";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import { LobbyisteFicheScreen } from "./LobbyisteFicheScreen.tsx";

const ID = lobbyisteDetailExemple.id;
const PATH = `/lobbying/${ID}`;
const routes = { [PATH]: { data: lobbyisteDetailExemple } };
const navigate = fn();

const meta = {
  title: "Écrans/Fiche d'un représentant d'intérêts",
  component: LobbyisteFicheScreen,
  args: { id: ID, params: {} },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, routes, navigate),
    docs: {
      description: {
        component:
          "Route `/lobbying/[id]`. Identité du représentant d'intérêts (donnée officielle du répertoire), chiffres clés et actions déclarées, filtrables par période. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof LobbyisteFicheScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Fédération d'exemple des jardins partagés",
    );
    await expect(
      ecran.getByRole("heading", { level: 2, name: /Actions de lobbying \(2\)/ }),
    ).toBeInTheDocument();
    await expect(ecran.getByRole("link", { name: "Camille Exemple" })).toHaveAttribute(
      "href",
      "/deputes/camille-exemple",
    );
  },
};

export const Periode: Story = {
  args: { params: { dateFrom: "2026-01-01" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(
      await ecran.findByRole("heading", { level: 2, name: /\(1 sur 2\)/ }),
    ).toBeInTheDocument();
    await expect(
      ecran.queryByRole("heading", { name: /projet de décret/ }),
    ).not.toBeInTheDocument();
  },
};

export const Vide: Story = {
  args: { params: { dateFrom: "2027-01-01", dateTo: "2027-12-31" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByText("Aucune action sur cette période")).toBeInTheDocument();
    await userEvent.click(ecran.getByRole("button", { name: "Retirer la période" }));
    await expect(navigate).toHaveBeenCalledWith(PATH);
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { [PATH]: jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement du représentant",
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
    await expect(await within(canvasElement).findByRole("heading", { level: 1 })).toHaveTextContent(
      /introuvable/i,
    );
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
