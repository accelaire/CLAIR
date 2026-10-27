import type { Meta, StoryObj } from "@storybook/react-vite";
import { lobbyisteExemple } from "../fixtures.ts";
import { LobbyisteLogo } from "./LobbyisteLogo.tsx";

/** Logo d'exemple généré localement (aucun service tiers, aucune organisation réelle). */
const logoExemple = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="8" y="8" width="48" height="48" rx="8" fill="#1d4ed8"/><path d="M20 44V20h24v6H27v4h14v6H27v8z" fill="#fff"/></svg>',
)}`;

const meta = {
  title: "Composants/Parlementaire/LobbyisteLogo",
  component: LobbyisteLogo,
  args: { nom: lobbyisteExemple.nom, logoUrl: logoExemple, size: "md", decorative: false },
  argTypes: {
    nom: { description: "Nom du représentant d'intérêts.", table: { category: "Contenu" } },
    logoUrl: {
      description: "Adresse du logo, calculée par l'application. Absente : initiales.",
      table: { category: "Contenu" },
    },
    size: {
      description: "Taille du logo.",
      control: { type: "inline-radio", labels: { sm: "Petit", md: "Moyen", lg: "Grand" } },
      options: ["sm", "md", "lg"],
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
          "Logo d'un représentant d'intérêts, ou ses initiales en repli. Remplace `lobbying/LobbyisteLogo.tsx` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof LobbyisteLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const Repli: Story = { args: { logoUrl: null } };

export const Tailles: Story = {
  args: { logoUrl: null },
  render: (args) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <LobbyisteLogo {...args} size="sm" />
      <LobbyisteLogo {...args} size="md" />
      <LobbyisteLogo {...args} size="lg" />
    </div>
  ),
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { ...Tailles, globals: { theme: "dark" } };
