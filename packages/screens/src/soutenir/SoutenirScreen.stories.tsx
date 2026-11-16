import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { SoutenirScreen } from "./SoutenirScreen.tsx";

/** Chiffres fictifs, repris du test de l'écran. */
const chiffres = { scrutins: 12345, amendements: 678, interventions: 90, actionsLobby: 4321 };

const meta = {
  title: "Écrans/Soutenir",
  component: SoutenirScreen,
  args: { initialData: chiffres },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Route `/soutenir`. Appel au don (formulaire HelloAsso intégré sur grand écran, lien direct en mobile), chiffres de CLAIR chargés par la route, autres façons d'aider, équipe et questions fréquentes. Données fictives.",
      },
    },
  },
} satisfies Meta<typeof SoutenirScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent(
      "CLAIR reste gratuit grâce à vous",
    );
    await expect(ecran.getByText("12 345")).toBeInTheDocument();
    await expect(ecran.getByTitle("Formulaire de don HelloAsso")).toHaveAttribute(
      "src",
      expect.stringContaining("helloasso.com"),
    );
    // Questions fréquentes : la première est ouverte ; en ouvrir une autre referme la première.
    const deductible = ecran.getByRole("button", {
      name: "Les dons sont-ils déductibles des impôts ?",
    });
    const usage = ecran.getByRole("button", { name: "À quoi servent les dons ?" });
    await expect(deductible).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(usage);
    await expect(usage).toHaveAttribute("aria-expanded", "true");
    await expect(deductible).toHaveAttribute("aria-expanded", "false");
  },
};

/** Sans les chiffres (API indisponible) : la section disparaît, la page de don reste servie. */
export const SansChiffres: Story = {
  args: { initialData: undefined },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(
      ecran.queryByRole("heading", { name: "Ce que vous trouvez déjà sur CLAIR" }),
    ).toBeNull();
    await expect(
      ecran.getByRole("heading", { level: 2, name: "Faire un don" }),
    ).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  globals: { viewport: { value: "xs" } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("link", { name: /^Faire un don.*nouvelle fenêtre/ }),
    ).toBeVisible();
  },
};
export const Sombre: Story = { globals: { theme: "dark" } };
