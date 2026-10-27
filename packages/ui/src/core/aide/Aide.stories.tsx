import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { Aide } from "./Aide.tsx";

const meta = {
  title: "Composants/Fondations/Aide",
  component: Aide,
  args: {
    label: "taux de participation",
    children: "Part des scrutins publics auxquels le parlementaire a pris part, sur la période.",
    position: "bottom",
  },
  argTypes: {
    label: {
      description: "Sujet de l'aide ; le bouton s'appelle « Aide : <sujet> ».",
      table: { category: "Contenu" },
    },
    children: {
      description: "Explication affichée dans la bulle.",
      table: { category: "Contenu" },
    },
    learnMoreHref: {
      description: "Page qui détaille le sujet.",
      table: { category: "Contenu" },
    },
    learnMoreLabel: {
      description: "Libellé du lien vers la page détaillée.",
      table: { category: "Contenu" },
    },
    position: {
      description: "Position préférée de la bulle.",
      control: {
        type: "select",
        labels: { top: "Au-dessus", bottom: "En dessous", left: "À gauche", right: "À droite" },
      },
      options: ["top", "bottom", "left", "right"],
      table: { category: "Apparence" },
    },
  },
  decorators: [
    (Story) => (
      <p style={{ minHeight: 180 }}>
        Taux de participation <Story />
      </p>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Bulle d'aide ouverte au clic, au toucher ou au clavier (pas au seul survol). Remplace `DidacticielTooltip` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof Aide>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

/** Entrée ouvre la bulle, Échap la ferme et rend le focus au bouton. */
export const Clavier: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Aide : taux de participation" });
    await userEvent.tab();
    await expect(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    const dialog = await screen.findByRole("dialog", { name: "Aide : taux de participation" });
    await waitFor(() => expect(dialog).toBeVisible());
    await userEvent.keyboard("{Escape}");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(button).toHaveFocus());
  },
};

/** La bulle s'ouvre au clic (ou au toucher) et propose une page détaillée. */
export const AvecLien: Story = {
  args: { learnMoreHref: "/comprendre/participation" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Aide : taux de participation" }));
    const link = await screen.findByRole("link", { name: "En savoir plus" });
    await waitFor(() => expect(link).toBeVisible());
  },
};

/**
 * Au clavier, le focus entre dans la bulle sur « En savoir plus » et y reste à la tabulation
 * (la bulle est rendue en fin de page) ; Échap le rend au bouton. Testé ici, dans un vrai
 * navigateur : happy-dom ne calcule pas la taille des éléments, et le piège du focus n'y trouve rien.
 */
export const ClavierAvecLien: Story = {
  args: { learnMoreHref: "/comprendre/participation" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Aide : taux de participation" });
    await userEvent.tab();
    await expect(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    const link = await screen.findByRole("link", { name: "En savoir plus" });
    await waitFor(() => expect(link).toHaveFocus());
    await userEvent.tab();
    await expect(link).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(button).toHaveFocus());
  },
};

export const ContenuLong: Story = {
  args: {
    label: "sort d'un amendement",
    children:
      "Le sort indique ce qu'il est advenu de l'amendement en séance : adopté, rejeté, retiré par son auteur, tombé parce que l'article visé a été supprimé, ou non soutenu parce que personne ne l'a défendu. Un amendement déclaré irrecevable n'est pas discuté.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Aide : sort d'un amendement" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeVisible());
  },
};

export const Mobile: Story = { ...ContenuLong, globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { ...AvecLien, globals: { theme: "dark" } };
