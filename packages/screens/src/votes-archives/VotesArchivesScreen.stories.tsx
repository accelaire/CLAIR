import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { pageScrutins, scrutinsExemples } from "../scrutins-liste/fixtures.ts";
import { enErreur, jamais, parametresEcran } from "../story-utils.ts";
import { VotesArchivesScreen } from "./VotesArchivesScreen.tsx";

const routes = {
  "/scrutins/annees": { data: [{ year: 2025, count: 1234 }] },
  "/scrutins": pageScrutins(scrutinsExemples, { totalPages: 2, total: 60 }),
};

const meta = {
  title: "Écrans/Archives des votes",
  component: VotesArchivesScreen,
  args: { periode: { annee: 2025, mois: null }, params: {} },
  parameters: {
    layout: "fullscreen",
    ...parametresEcran("/votes/2025", routes),
    docs: {
      description: {
        component:
          "Routes `/votes`, `/votes/[annee]` et `/votes/[annee]/[mois]`. Index des années, puis scrutins d'une année ou d'un mois, avec la navigation entre les mois et la pagination en liens. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof VotesArchivesScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Une année : ses mois, ses scrutins et la pagination. */
export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("heading", { level: 1 })).toBeInTheDocument();
    await expect(ecran.getByRole("link", { name: /L'amendement d'exemple n° 3/ })).toHaveAttribute(
      "href",
      "/scrutins/12?chambre=senat&session=2025",
    );
    await expect(ecran.getByRole("link", { name: "Mars" })).toHaveAttribute(
      "href",
      "/votes/2025/03",
    );
    await expect(ecran.getByRole("link", { name: "Page 2" })).toHaveAttribute(
      "href",
      "/votes/2025?page=2",
    );
  },
};

/** Index des années (`/votes`). */
export const Annees: Story = {
  args: { periode: null },
  parameters: parametresEcran("/votes", routes),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Archives des votes",
    );
    await expect(ecran.getByRole("link", { name: "2025" })).toHaveAttribute("href", "/votes/2025");
  },
};

/** Un mois, avec le mois précédent et le suivant. */
export const Mois: Story = {
  args: { periode: { annee: 2025, mois: 1 } },
  parameters: parametresEcran("/votes/2025/01", routes),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Votes Janvier 2025",
    );
    await expect(ecran.getByRole("link", { name: /Décembre 2024/ })).toHaveAttribute(
      "href",
      "/votes/2024/12",
    );
    await expect(ecran.getByRole("link", { name: /Février 2025/ })).toHaveAttribute(
      "href",
      "/votes/2025/02",
    );
  },
};

export const Chargement: Story = {
  parameters: parametresEcran("/votes/2025", { "/scrutins": jamais }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Chargement des scrutins",
    );
  },
};

export const Vide: Story = {
  args: { periode: { annee: 2007, mois: null } },
  parameters: parametresEcran("/votes/2007", { "/scrutins": pageScrutins([]) }),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("Aucun scrutin sur cette période"),
    ).toBeInTheDocument();
  },
};

export const Erreur: Story = {
  parameters: parametresEcran("/votes/2025", { "/scrutins": enErreur(500, "/scrutins") }),
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(await ecran.findByRole("alert")).toBeInTheDocument();
    await expect(ecran.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
