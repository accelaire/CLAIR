import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import {
  groupeExemple,
  groupeExempleBis,
  groupeExempleSenat,
  groupesExemple,
  legislaturesExemple,
  sessionsExemple,
} from "./fixtures.ts";
import { GroupesListeScreen } from "./GroupesListeScreen.tsx";

const PATH = "/groupes";
const API = "/parlementaires/groupes";
const routes = {
  [API]: groupesExemple(),
  "/deputes/groupes": groupesExemple([groupeExemple, groupeExempleBis]),
  "/senateurs/groupes": groupesExemple([groupeExempleSenat]),
  "/deputes/legislatures": legislaturesExemple,
  "/scrutins/periodes": sessionsExemple,
};
const navigate = fn();

const meta = {
  title: "Écrans/Groupes parlementaires",
  component: GroupesListeScreen,
  args: { params: {} },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, routes, navigate),
    docs: {
      description: {
        component:
          "Route `/groupes`. Groupes de l'Assemblée nationale et du Sénat : recherche, choix de la chambre et de la période, hémicycle et cartes par chambre. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof GroupesListeScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Groupes parlementaires",
    );
    const cartes = within(await ecran.findByRole("list", { name: "Groupes, Assemblée nationale" }));
    await expect(cartes.getByRole("link", { name: /Groupe bis des jardiniers/ })).toHaveAttribute(
      "href",
      "/groupes/assemblee/gbis",
    );
    await userEvent.type(ecran.getByRole("searchbox", { name: "Rechercher un groupe" }), "bis");
    // La recherche attend la fin de la frappe avant de changer l'URL.
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(`${PATH}?search=bis`));
  },
};

export const Assemblee: Story = {
  args: { params: { chambre: "assemblee" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(
      await ecran.findByRole("list", { name: "Groupes, Assemblée nationale" }),
    ).toBeInTheDocument();
    await expect(ecran.queryByRole("heading", { level: 2, name: "Sénat" })).toBeNull();
  },
};

export const Recherche: Story = {
  args: { params: { search: "senatorial" } },
  play: async ({ canvasElement }) => {
    const liste = await within(canvasElement).findByRole("list", { name: "Groupes, Sénat" });
    await expect(
      within(liste).getByRole("link", { name: /Groupe sénatorial/ }),
    ).toBeInTheDocument();
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { ...routes, [API]: jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement des groupes",
    );
  },
};

export const Vide: Story = {
  args: { params: { search: "introuvable" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByText("Aucun groupe trouvé")).toBeInTheDocument();
    await userEvent.click(ecran.getByRole("button", { name: "Voir tous les groupes" }));
    await expect(navigate).toHaveBeenCalledWith(PATH);
  },
};

export const Erreur: Story = {
  parameters: parametresEcran(PATH, { ...routes, [API]: enErreur(500, API) }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("alert")).toBeInTheDocument();
    await expect(ecran.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
