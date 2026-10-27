import type { Meta, StoryObj } from "@storybook/react-vite";
import { groupesAssemblee, groupesSenat } from "../fixtures.ts";
import { GroupeBadge } from "./GroupeBadge.tsx";

const meta = {
  title: "Composants/Parlementaire/GroupeBadge",
  component: GroupeBadge,
  args: { sigle: "ECO", nom: "Écologiste et Social", size: "md" },
  argTypes: {
    sigle: { description: "Sigle du groupe, toujours affiché.", table: { category: "Contenu" } },
    nom: {
      description: "Nom complet, lu par les lecteurs d'écran et proposé en infobulle.",
      table: { category: "Contenu" },
    },
    couleur: {
      description:
        "Couleur fournie par l'API (hex ou « r,g,b »). Absente : token `--clair-groupe-<sigle>`.",
      control: "color",
      table: { category: "Apparence" },
    },
    size: {
      description: "Taille du badge.",
      control: { type: "inline-radio", labels: { sm: "Petit", md: "Moyen" } },
      options: ["sm", "md"],
      table: { category: "Apparence" },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Groupe politique : pastille de couleur et sigle toujours affiché. Remplace `.groupe-badge` et `getGroupColor` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof GroupeBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

const liste = { display: "flex", flexWrap: "wrap", gap: 8 } as const;

/** Couleurs de repli des tokens `--clair-groupe-*`. */
export const GroupesAssemblee: Story = {
  render: (args) => (
    <div style={liste}>
      {groupesAssemblee.map((groupe) => (
        <GroupeBadge key={groupe.sigle} {...args} sigle={groupe.sigle} nom={groupe.nom} />
      ))}
    </div>
  ),
};

/** Couleurs fournies par l'API (aucun token pour les groupes du Sénat). */
export const GroupesSenat: Story = {
  render: (args) => (
    <div style={liste}>
      {groupesSenat.map((groupe) => (
        <GroupeBadge
          key={groupe.sigle}
          {...args}
          sigle={groupe.sigle}
          nom={groupe.nom}
          couleur={groupe.couleur}
        />
      ))}
    </div>
  ),
};

/** Sigle inconnu et sans couleur : gris des non-inscrits. */
export const SansCouleur: Story = { args: { sigle: "XYZ", nom: "Groupe d'exemple" } };

export const Petit: Story = { args: { size: "sm" } };

export const Mobile: Story = { ...GroupesAssemblee, globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { ...GroupesAssemblee, globals: { theme: "dark" } };
