import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "../../core/badge/Badge.tsx";
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

export const Defaut: Story = {};

export const Promulgue: Story = { args: { dossier: dossierPromulgue } };

/** Usage « loi promulguée » de la page d'un dossier : liens officiels, sans lien bloc. */
export const LoiPromulguee: Story = { args: { dossier: dossierPromulgue, href: undefined } };

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
