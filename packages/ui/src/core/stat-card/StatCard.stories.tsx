import type { Meta, StoryObj } from "@storybook/react-vite";
import { MessageSquare, ShieldCheck, Users } from "lucide-react";
import { expect, within } from "storybook/test";
import { StatCard } from "./StatCard.tsx";

const meta = {
  title: "Composants/Fondations/StatCard",
  component: StatCard,
  args: { label: "Présence", value: 87, unit: "%", icon: <ShieldCheck /> },
  argTypes: {
    label: { description: "Libellé du chiffre.", table: { category: "Contenu" } },
    value: {
      description: "Chiffre clé ; `null` si la donnée n'est pas disponible.",
      table: { category: "Contenu" },
    },
    unit: { description: "Unité accolée au chiffre.", table: { category: "Contenu" } },
    icon: { description: "Icône décorative.", control: false, table: { category: "Contenu" } },
    detail: { description: "Précision sous le chiffre.", table: { category: "Contenu" } },
    variation: {
      description: "Variation, toujours écrite en toutes lettres et de ton neutre.",
      table: { category: "Contenu" },
    },
    help: { description: "Définition ou mode de calcul.", table: { category: "Contenu" } },
    as: {
      description: "Élément racine (`li` dans une liste de chiffres).",
      control: { type: "inline-radio" },
      options: ["div", "li"],
      table: { category: "Accessibilité" },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Chiffre clé et son libellé dans une liste de définitions. Fusionne les deux `StatCard` de apps/web et remplace `.stat-card`.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 280 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("term")).toHaveTextContent("Présence");
    await expect(canvas.getByRole("definition")).toHaveTextContent("87");
  },
};

export const AvecEvolution: Story = {
  args: { variation: { value: 3.2, unit: "points", period: "sur un an" } },
};

export const AvecAide: Story = {
  args: {
    label: "Présence solennelle",
    value: 92,
    detail: "87 % tous scrutins",
    help: "Calculé par CLAIR sur l'ensemble de la carrière parlementaire.",
  },
};

export const NonDisponible: Story = {
  args: { label: "Présence solennelle", value: null, help: "Le Sénat ne publie pas ce chiffre." },
};

/** Une grille de chiffres : chaque carte est un élément de liste. */
export const Grille: Story = {
  decorators: [
    (Story) => (
      <ul
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          margin: 0,
          padding: 0,
        }}
      >
        <Story />
      </ul>
    ),
  ],
  render: () => (
    <>
      <StatCard as="li" label="Présence" value={87} unit="%" icon={<ShieldCheck />} />
      <StatCard
        as="li"
        label="Interventions"
        value={1234}
        icon={<MessageSquare />}
        variation={{ value: -12, period: "sur un an" }}
      />
      <StatCard as="li" label="Membres" value={88} icon={<Users />} />
    </>
  ),
};

export const Mobile: Story = { ...AvecEvolution, globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { ...AvecAide, globals: { theme: "dark" } };
