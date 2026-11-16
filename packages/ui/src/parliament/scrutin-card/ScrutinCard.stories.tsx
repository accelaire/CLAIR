import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { attendreFocusVisible, carteDe } from "../../story-utils.ts";
import { scrutinAdopte, scrutinRejete } from "../fixtures.ts";
import { ScrutinCard } from "./ScrutinCard.tsx";

const meta = {
  title: "Composants/Parlementaire/ScrutinCard",
  component: ScrutinCard,
  args: {
    scrutin: { ...scrutinAdopte, importance: 2 },
    href: "#scrutin-1234",
    periode: "17e législature",
  },
  argTypes: {
    scrutin: {
      description:
        "Scrutin : numéro, chambre, date, mode, thématiques (`tags`, trois au plus), titre, sort et décompte des voix.",
      table: { category: "Contenu" },
    },
    href: { description: "Adresse du scrutin (unique lien).", table: { category: "Contenu" } },
    periode: {
      description: "Période qui désambiguïse le numéro (session, législature).",
      table: { category: "Contenu" },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Carte d'un scrutin : thématiques (trois au plus, les autres comptées), résultat chiffré en texte et sort en badge. Remplace `scrutins/ScrutinListCard.tsx` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof ScrutinCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Décompte d'une position : terme (`dt`) suivi de sa valeur (`dd`). */
const decompte = (canvasElement: HTMLElement, position: string) =>
  within(canvasElement).getByText(position, { selector: "dt" }).nextElementSibling;

/**
 * Le titre est l'unique lien de la carte, et l'anneau de focus entoure toute la carte. Trois
 * thématiques au plus, les autres comptées ; résultat chiffré et sort en texte.
 */
export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const titre =
      "l'ensemble du projet de loi d'exemple relatif à la simplification administrative";
    await expect(canvas.getByRole("heading", { level: 3, name: titre })).toBeVisible();
    await expect(canvas.getAllByRole("link")).toHaveLength(1);
    const lien = canvas.getByRole("link", { name: titre });
    await expect(lien).toHaveAttribute("href", "#scrutin-1234");
    await userEvent.tab();
    await attendreFocusVisible(lien, carteDe(lien));

    await expect(canvas.getByText("Scrutin n° 1234")).toBeVisible();
    await expect(canvas.getByText("17e législature")).toBeVisible();
    await expect(canvas.getByText("Vote solennel")).toBeVisible();
    await expect(canvas.getByText(/^Budget, Santé, Travail/)).toHaveTextContent(
      "Thématiques : Budget, Santé, Travail +2 et 2 autres",
    );
    await expect(decompte(canvasElement, "Pour")).toHaveTextContent("312");
    await expect(decompte(canvasElement, "Contre")).toHaveTextContent("205");
    await expect(decompte(canvasElement, "Abstention")).toHaveTextContent("41");
    await expect(canvas.getByText("Adopté")).toBeVisible();
    // Importance 2 : sous le seuil, pas de mention « Important ».
    await expect(canvas.queryByText(/Important/)).toBeNull();
  },
};

export const Rejete: Story = {
  args: { scrutin: scrutinRejete, href: "#scrutin-87", periode: "Session 2025-2026" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Rejeté")).toBeVisible();
    await expect(canvas.getByText("Session 2025-2026")).toBeVisible();
    await expect(decompte(canvasElement, "Contre")).toHaveTextContent("230");
  },
};

/** Importance calculée par CLAIR (classement automatique), annoncée comme telle. */
export const Important: Story = {
  args: { scrutin: scrutinAdopte },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Important · calculé par CLAIR")).toBeVisible();
  },
};

/** Sans thématique : la ligne ne s'affiche pas. */
export const SansThematique: Story = {
  args: { scrutin: { ...scrutinAdopte, tags: [] } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(/Thématiques/)).toBeNull();
  },
};

export const Mobile: Story = { ...Defaut, globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { args: { scrutin: scrutinAdopte }, globals: { theme: "dark" } };
