import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Badge } from "../../core/badge/Badge.tsx";
import { attendreFocusVisible, carteDe } from "../../story-utils.ts";
import { dossierEnCours, dossierPromulgue } from "../fixtures.ts";
import { DossierCard } from "./DossierCard.tsx";

const meta = {
  title: "Composants/Parlementaire/DossierCard",
  component: DossierCard,
  args: { dossier: dossierEnCours, href: "#dossier-exemple" },
  argTypes: {
    dossier: {
      description: "Dossier : titre, état, chambre, dates, compteurs, loi promulguée.",
      table: { category: "Contenu" },
    },
    href: {
      description: "Adresse du dossier. Sans adresse : carte statique avec les liens de la loi.",
      table: { category: "Contenu" },
    },
    contexte: {
      description: "Badge de contexte placé en premier (rôle de saisine…).",
      table: { category: "Contenu" },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Carte d'un dossier législatif. Fusionne `dossiers/DossierCard.tsx` et `LoiPromulgueeCard.tsx` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof DossierCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Titre préfixé de la procédure, unique lien de la carte, atteint à la tabulation ; état,
 * chambre et compteurs en texte.
 */
export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const titre = "Proposition de loi relative à la protection des exemples dans l'espace public";
    await expect(canvas.getByRole("heading", { level: 3, name: titre })).toBeVisible();
    await expect(canvas.getAllByRole("link")).toHaveLength(1);
    const lien = canvas.getByRole("link", { name: titre });
    await expect(lien).toHaveAttribute("href", "#dossier-exemple");
    await userEvent.tab();
    await attendreFocusVisible(lien, carteDe(lien));
    await expect(canvas.getByText("4 scrutins")).toBeVisible();
    await expect(canvas.getByText("128 amendements")).toBeVisible();
    await expect(canvas.getByText(/^Dernier vote le/)).toBeVisible();
  },
};

export const Promulgue: Story = {
  args: { dossier: dossierPromulgue },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("link")).toHaveLength(1);
    await expect(
      canvas.getByText(/^Loi n° 2026-0000, publiée au Journal officiel le/),
    ).toBeVisible();
  },
};

/** Usage « loi promulguée » de la page d'un dossier : liens officiels, sans lien bloc. */
export const LoiPromulguee: Story = {
  args: { dossier: dossierPromulgue, href: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByRole("link", {
        name: "Projet de loi d'exemple pour la simplification administrative",
      }),
    ).toBeNull();
    const legifrance = canvas.getByRole("link", {
      name: "Texte de la loi sur Légifrance (nouvelle fenêtre)",
    });
    const journal = canvas.getByRole("link", { name: "Journal officiel (nouvelle fenêtre)" });
    await expect(legifrance).toHaveAttribute("target", "_blank");
    await userEvent.tab();
    await attendreFocusVisible(legifrance);
    await userEvent.tab();
    await attendreFocusVisible(journal);
  },
};

export const AvecContexte: Story = {
  args: {
    contexte: (
      <Badge tone="info" size="sm">
        Saisie au fond
      </Badge>
    ),
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };

export const Sombre: Story = {
  args: { dossier: dossierPromulgue, href: undefined },
  globals: { theme: "dark" },
};
