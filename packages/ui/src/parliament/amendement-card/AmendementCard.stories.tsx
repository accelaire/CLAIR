import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { amendementAdopte, sousAmendement } from "../fixtures.ts";
import { AmendementCard } from "./AmendementCard.tsx";

const meta = {
  title: "Composants/Parlementaire/AmendementCard",
  component: AmendementCard,
  args: {
    amendement: amendementAdopte,
    groupe: { sigle: "ECO", nom: "Écologiste et Social" },
    scrutins: [{ numero: 1234, href: "#scrutin-1234" }],
    dossier: { label: "Projet de loi d'exemple", href: "#dossier-exemple" },
  },
  argTypes: {
    amendement: {
      description: "Amendement : numéro, sort, article visé, auteur, exposé, dispositif.",
      table: { category: "Contenu" },
    },
    groupe: { description: "Groupe de l'auteur.", table: { category: "Contenu" } },
    showAuteur: {
      description: "Affiche l'auteur (masqué sur sa propre fiche).",
      control: "boolean",
      table: { category: "Contenu" },
    },
    parentHref: {
      description: "Adresse de l'amendement parent d'un sous-amendement.",
      table: { category: "Contenu" },
    },
    scrutins: { description: "Scrutins publics de l'amendement.", table: { category: "Contenu" } },
    dossier: { description: "Dossier législatif.", table: { category: "Contenu" } },
    highlighted: {
      description: "Amendement visé par l'adresse : mis en évidence.",
      control: "boolean",
      table: { category: "Apparence" },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Carte d'un amendement, exposé repliable. Fusionne `ExpandableAmendementCard`, son doublon de la fiche sénateur et `AmendementSeance` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof AmendementCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

/** L'exposé se déplie avec « Lire la suite » et se replie avec « Réduire ». */
export const Deplie: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [bouton] = canvas.getAllByRole("button", { name: /Lire la suite/ });
    if (!bouton) throw new Error("Bouton « Lire la suite » absent");
    await userEvent.click(bouton);
    await expect(bouton).toHaveAttribute("aria-expanded", "true");
    await expect(bouton).toHaveAccessibleName(/Réduire/);
  },
};

export const SousAmendement: Story = {
  args: {
    amendement: sousAmendement,
    groupe: { sigle: "UC", nom: "Union Centriste", couleur: "#00BFFF" },
    parentHref: "#amendement-42",
    scrutins: [],
    dossier: null,
  },
};

export const SansSort: Story = {
  args: { amendement: { ...amendementAdopte, sort: null }, scrutins: [] },
};

export const MisEnEvidence: Story = { args: { highlighted: true } };

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { globals: { theme: "dark" } };
