import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatutBadge } from "./StatutBadge.tsx";
import { STATUTS, type Statut } from "./statuts.ts";

const statuts = Object.keys(STATUTS).filter((key): key is Statut => key in STATUTS);

const meta = {
  title: "Composants/Fondations/StatutBadge",
  component: StatutBadge,
  args: { statut: "adopte", size: "md" },
  argTypes: {
    statut: {
      description: "Statut législatif ; le ton vient du mapping central `STATUTS`.",
      control: {
        type: "select",
        labels: Object.fromEntries(statuts.map((statut) => [statut, STATUTS[statut].label])),
      },
      options: statuts,
      table: { category: "Contenu" },
    },
    label: {
      description: "Libellé plus précis que celui du statut, ton inchangé.",
      table: { category: "Contenu" },
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
          "Statut législatif (sort d'un scrutin ou d'un amendement, état d'un dossier). Remplace `AmendementSortBadge` et les classes `.badge-*` de statut de apps/web.",
      },
    },
  },
} satisfies Meta<typeof StatutBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

const Liste = ({ items }: { items: Statut[] }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
    {items.map((statut) => (
      <StatutBadge key={statut} statut={statut} />
    ))}
  </div>
);

/** Sort d'un scrutin ou d'un amendement. */
export const Sorts: Story = {
  render: () => (
    <Liste
      items={[
        "adopte",
        "adopte_modifie",
        "rejete",
        "retire",
        "tombe",
        "non_soutenu",
        "irrecevable",
        "satisfait",
        "en_attente",
      ]}
    />
  ),
};

/** État d'un dossier législatif. */
export const EtatsDossier: Story = {
  render: () => (
    <Liste items={["en_cours", "adopte", "rejete", "promulgue", "caduc", "fusionne"]} />
  ),
};

export const LibellePrecis: Story = {
  args: { statut: "irrecevable", label: "Irrecevable (art. 40)" },
};

export const Petit: Story = { args: { statut: "promulgue", size: "sm" } };

export const Mobile: Story = { ...Sorts, globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { ...Sorts, globals: { theme: "dark" } };
