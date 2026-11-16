import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import {
  alliancesExemple,
  groupeDetailExemple,
  thematiquesExemple,
  votesExemple,
} from "./fixtures.ts";
import { GroupeFicheScreen } from "./GroupeFicheScreen.tsx";

const PATH = "/groupes/assemblee/gex";
const routes = {
  [PATH]: { data: groupeDetailExemple },
  [`${PATH}/votes`]: votesExemple,
  [`${PATH}/alliances`]: alliancesExemple,
  [`${PATH}/thematiques`]: thematiquesExemple,
};
const navigate = fn();

const meta = {
  title: "Écrans/Fiche d'un groupe",
  component: GroupeFicheScreen,
  args: { chambre: "assemblee", slug: "gex", params: {} },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, routes, navigate),
    docs: {
      description: {
        component:
          "Route `/groupes/[chambre]/[slug]`. En-tête, chiffres clés, votes, proximité, cohésion par thème et membres. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof GroupeFicheScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("heading", { level: 1 })).toHaveTextContent("GEX");
    await userEvent.click(
      await ecran.findByRole("button", { name: "Seulement les scrutins demandés par le groupe" }),
    );
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?initie=1`);
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { ...routes, [PATH]: jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement du groupe",
    );
  },
};

export const Vide: Story = {
  parameters: parametresEcran(PATH, {
    ...routes,
    [`${PATH}/votes`]: { data: { ...votesExemple.data, totalVotes: 0, scrutinsRecents: [] } },
    [`${PATH}/alliances`]: { data: { ...alliancesExemple.data, allies: [] } },
    [`${PATH}/thematiques`]: { data: { ...thematiquesExemple.data, thematiques: [] } },
  }),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("Aucune donnée de vote disponible"),
    ).toBeInTheDocument();
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
    await expect(
      await within(canvasElement).findByRole("heading", { level: 1 }),
    ).toBeInTheDocument();
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
