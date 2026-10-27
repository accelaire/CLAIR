import type { Meta, StoryObj } from "@storybook/react-vite";
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
      description: "Scrutin : numéro, chambre, date, titre, sort et décompte des voix.",
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
          "Carte d'un scrutin : résultat chiffré en texte et sort en badge. Remplace `scrutins/ScrutinListCard.tsx` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof ScrutinCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const Rejete: Story = {
  args: { scrutin: scrutinRejete, href: "#scrutin-87", periode: "Session 2025-2026" },
};

/** Importance calculée par CLAIR (classement automatique), annoncée comme telle. */
export const Important: Story = { args: { scrutin: scrutinAdopte } };

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { args: { scrutin: scrutinAdopte }, globals: { theme: "dark" } };
