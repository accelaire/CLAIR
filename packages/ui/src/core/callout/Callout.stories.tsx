import type { Meta, StoryObj } from "@storybook/react-vite";
import { Heart, Vote } from "lucide-react";
import { expect, within } from "storybook/test";
import { Callout } from "./Callout.tsx";

const meta = {
  title: "Composants/Fondations/Callout",
  component: Callout,
  args: {
    tone: "info",
    title: "Siège remis en jeu le 27 septembre 2026",
    children: "Ce siège fait partie des sièges renouvelés avec la série 2 du Sénat.",
  },
  argTypes: {
    tone: {
      description: "Ton de l'encart ; l'icône et le titre portent le sens, pas la couleur seule.",
      control: {
        type: "inline-radio",
        labels: {
          info: "Information",
          "mise-en-avant": "Mise en avant",
          avertissement: "Avertissement",
        },
      },
      options: ["info", "mise-en-avant", "avertissement"],
      table: { category: "Apparence" },
    },
    title: { description: "Titre de l'encart.", table: { category: "Contenu" } },
    titleAs: {
      description: "Niveau du titre, selon la hiérarchie de la page.",
      control: { type: "select" },
      options: ["h2", "h3", "h4", "h5", "h6"],
      table: { category: "Accessibilité" },
    },
    icon: {
      description: "Icône décorative ; `null` pour n'en afficher aucune.",
      control: false,
      table: { category: "Contenu" },
    },
    action: { description: "Action unique : un lien.", table: { category: "Contenu" } },
    as: {
      description: "Élément racine ; `section` et `aside` créent un repère nommé par le titre.",
      control: { type: "inline-radio" },
      options: ["div", "section", "aside"],
      table: { category: "Accessibilité" },
    },
    children: { description: "Contenu de l'encart.", table: { category: "Contenu" } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Encart d'information, de mise en avant ou d'avertissement, avec au plus une action. Remplace `FicheCompareCallout`, `SiegeRenouvelableCallout`, `SoutenirCallout` et `EncartResultats` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof Callout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const Tons: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 16 }}>
      <Callout tone="info" title="Information">
        Les données du Sénat sont mises à jour chaque nuit.
      </Callout>
      <Callout tone="mise-en-avant" title="Aller plus loin">
        Comparez deux parcours, indicateur par indicateur.
      </Callout>
      <Callout tone="avertissement" title="Données incomplètes">
        Certains scrutins de 2024 ne sont pas encore publiés.
      </Callout>
    </div>
  ),
};

/** L'action est un lien unique, rendu comme un bouton. */
export const AvecAction: Story = {
  args: {
    icon: <Vote />,
    action: { label: "Voir les candidats", href: "/senatoriales-2026" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "Voir les candidats" })).toHaveAttribute(
      "href",
      "/senatoriales-2026",
    );
  },
};

/** Appel au don en pied de contenu (ancien `SoutenirCallout`). */
export const Soutenir: Story = {
  args: {
    tone: "mise-en-avant",
    icon: <Heart />,
    title: "Cette page est gratuite, sans publicité et sans financement politique.",
    children:
      "CLAIR est une association d'intérêt général : un don de 10 € vous revient à 3,40 € après déduction fiscale.",
    action: { label: "Soutenir CLAIR", href: "/soutenir" },
    as: "aside",
  },
};

export const Avertissement: Story = {
  args: {
    tone: "avertissement",
    title: "Données en cours de mise à jour",
    children: "Les votes de la dernière séance seront disponibles demain.",
    action: {
      label: "Site de l'Assemblée nationale",
      href: "https://www.assemblee-nationale.fr",
      external: true,
    },
  },
};

export const SansTitre: Story = { args: { title: undefined } };

export const Mobile: Story = { ...AvecAction, globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { ...Tons, globals: { theme: "dark" } };
