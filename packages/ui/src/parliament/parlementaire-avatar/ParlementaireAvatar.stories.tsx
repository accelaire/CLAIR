import type { Meta, StoryObj } from "@storybook/react-vite";
import { ParlementaireAvatar } from "./ParlementaireAvatar.tsx";

/** Photo d'exemple générée localement (aucune image distante, aucune personne réelle). */
const photoExemple = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#94a3b8"/><circle cx="32" cy="26" r="12" fill="#e2e8f0"/><rect x="14" y="42" width="36" height="22" rx="11" fill="#e2e8f0"/></svg>',
)}`;

const meta = {
  title: "Composants/Parlementaire/ParlementaireAvatar",
  component: ParlementaireAvatar,
  args: { nom: "Camille Exemple", photoUrl: photoExemple, size: "lg", decorative: false },
  argTypes: {
    nom: {
      description: "Nom affiché, texte alternatif de la photo.",
      table: { category: "Contenu" },
    },
    photoUrl: {
      description: "Photo officielle. Absente ou en erreur : initiales.",
      table: { category: "Contenu" },
    },
    size: {
      description: "Taille de l'avatar.",
      control: {
        type: "inline-radio",
        labels: { sm: "Petit", md: "Moyen", lg: "Grand", xl: "Très grand" },
      },
      options: ["sm", "md", "lg", "xl"],
      table: { category: "Apparence" },
    },
    decorative: {
      description: "Masqué aux lecteurs d'écran quand le nom est écrit à côté.",
      control: "boolean",
      table: { category: "Accessibilité" },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Photo d'un député ou d'un sénateur, ou ses initiales en repli. Remplace les photos des cartes et fiches de apps/web.",
      },
    },
  },
} satisfies Meta<typeof ParlementaireAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const SansPhoto: Story = { args: { photoUrl: null } };

export const Tailles: Story = {
  args: { photoUrl: null },
  render: (args) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <ParlementaireAvatar {...args} size="sm" />
      <ParlementaireAvatar {...args} size="md" />
      <ParlementaireAvatar {...args} size="lg" />
      <ParlementaireAvatar {...args} size="xl" />
    </div>
  ),
};

/** Photo introuvable : repli sur les initiales. */
export const PhotoEnErreur: Story = { args: { photoUrl: "/photo-introuvable.jpg" } };

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { ...Tailles, globals: { theme: "dark" } };
