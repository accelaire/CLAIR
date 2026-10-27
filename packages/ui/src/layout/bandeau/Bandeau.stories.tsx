import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Bandeau } from "./Bandeau.tsx";

const meta = {
  title: "Composants/Mise en page/Bandeau",
  component: Bandeau,
  args: {
    tone: "info",
    children: "La documentation des données a été mise à jour.",
    link: { href: "/methodologie", label: "En savoir plus" },
    dismissible: false,
  },
  argTypes: {
    tone: {
      description: "Ton : annonce, ou évènement en cours (mention « En direct » et pastille).",
      control: { type: "inline-radio", labels: { info: "Information", direct: "En direct" } },
      options: ["info", "direct"],
      table: { category: "Apparence" },
    },
    children: { description: "Texte de l'annonce.", table: { category: "Contenu" } },
    link: { description: "Lien vers le détail.", table: { category: "Contenu" } },
    dismissible: {
      description: "Affiche un bouton pour masquer le bandeau.",
      control: "boolean",
      table: { category: "Comportement" },
    },
    onDismiss: { description: "Appelé au masquage.", table: { category: "Événements" } },
    dismissLabel: {
      description: "Nom accessible du bouton de fermeture.",
      table: { category: "Comportement" },
    },
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Bandeau d'annonce au-dessus de l'en-tête : information ou « en direct » (pastille animée, immobile si les animations sont réduites), lien et fermeture optionnels. Remplace `components/layout/BandeauDirect.tsx` de apps/web ; les données viennent des props.",
      },
    },
  },
} satisfies Meta<typeof Bandeau>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const EnDirect: Story = {
  args: {
    tone: "direct",
    children: "Élections fictives : les résultats arrivent, circonscription par circonscription.",
    link: { href: "/elections#resultats", label: "Suivre les résultats" },
    dismissible: true,
    dismissLabel: "Masquer le bandeau du direct",
  },
};

export const SansLien: Story = { args: { link: undefined } };

/** Le bouton masque le bandeau et prévient l'application. */
export const Fermable: Story = {
  args: { dismissible: true, onDismiss: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("region", { name: "Annonce" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Masquer le bandeau" }));
    await expect(args.onDismiss).toHaveBeenCalledOnce();
    await expect(canvas.queryByRole("region", { name: "Annonce" })).toBeNull();
  },
};

export const Mobile: Story = { ...EnDirect, globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { ...EnDirect, globals: { theme: "dark" } };
