import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import { CommissionsListeScreen } from "./CommissionsListeScreen.tsx";
import { commissionExemple, commissionExempleSenat, pageCommissions } from "./fixtures.ts";

const PATH = "/commissions";
const routes = { [PATH]: pageCommissions([commissionExemple, commissionExempleSenat]) };
const navigate = fn();

const meta = {
  title: "Écrans/Liste des commissions",
  component: CommissionsListeScreen,
  args: { params: {} },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran(PATH, routes, navigate),
    docs: {
      description: {
        component:
          "Route `/commissions`. Commissions et organes des deux chambres, rangés par type, avec recherche, filtre de chambre, de type et organes passés. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof CommissionsListeScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Commissions parlementaires",
    );
    await expect(await ecran.findByRole("link", { name: /jardins partagés/ })).toHaveAttribute(
      "href",
      "/commissions/assemblee-commission-des-jardins-partages",
    );
    await userEvent.selectOptions(ecran.getByLabelText("Type d'organe"), "enquete");
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?type=enquete`);
    await userEvent.click(ecran.getByRole("checkbox", { name: "Inclure les organes passés" }));
    await expect(navigate).toHaveBeenCalledWith(`${PATH}?historique=1`);
  },
};

export const Recherche: Story = {
  args: { params: { search: "bibliotheques" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("link", { name: /bibliothèques/ })).toBeInTheDocument();
    await expect(ecran.queryByRole("link", { name: /jardins partagés/ })).not.toBeInTheDocument();
  },
};

export const Senat: Story = {
  args: { params: { chambre: "senat" } },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    // Les types autres que le premier sont repliés ; le sommaire y mène, le titre les déplie.
    const sommaire = await ecran.findByRole("navigation", { name: "Types d'organes" });
    await expect(within(sommaire).getByRole("link", { name: "Groupes d'études" })).toHaveAttribute(
      "href",
      "#type-groupe_etudes",
    );
    await userEvent.click(ecran.getByRole("button", { name: /Groupes d'études/ }));
    await expect(ecran.getByRole("button", { name: /Groupes d'études/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(ecran.getByRole("link", { name: /bibliothèques/ })).toBeInTheDocument();
  },
};

export const Chargement: Story = {
  parameters: parametresEcran(PATH, { [PATH]: jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement des commissions",
    );
  },
};

export const Vide: Story = {
  args: { params: { type: "office" } },
  parameters: parametresEcran(PATH, { [PATH]: pageCommissions([]) }, navigate),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByText("Aucune commission trouvée")).toBeInTheDocument();
    await userEvent.click(ecran.getByRole("button", { name: "Effacer les filtres" }));
    await expect(navigate).toHaveBeenCalledWith(PATH);
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

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
