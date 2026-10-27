import type { Meta, StoryObj } from "@storybook/react-vite";
import { Container } from "./Container.tsx";

const Contenu = () => (
  <div
    style={{
      padding: "var(--clair-espacement-4v)",
      border: "var(--clair-trait-defaut)",
      background: "var(--clair-fond-neutre)",
      color: "var(--clair-texte-defaut)",
    }}
  >
    <h1 style={{ marginTop: 0 }}>Titre de la page</h1>
    <p style={{ marginBottom: 0 }}>
      Le contenu de la page est centré et ne dépasse pas la largeur maximale du site ; les marges
      latérales s'adaptent à l'écran.
    </p>
  </div>
);

const meta = {
  title: "Composants/Mise en page/Container",
  component: Container,
  args: { size: "normal", as: "div", children: <Contenu /> },
  argTypes: {
    size: {
      description: "Largeur maximale : largeur du site ou colonne de lecture (768 px).",
      control: { type: "inline-radio", labels: { normal: "Normale", etroit: "Étroite" } },
      options: ["normal", "etroit"],
      table: { category: "Apparence" },
    },
    as: {
      description: "Élément HTML rendu.",
      control: { type: "inline-radio" },
      options: ["div", "section", "article"],
      table: { category: "Sémantique" },
    },
    children: { description: "Contenu.", control: false, table: { category: "Contenu" } },
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Conteneur de contenu : largeur maximale (`--clair-largeur-contenu`) et marges latérales. Remplace les `container mx-auto px-4` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof Container>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

/** Colonne de lecture pour les textes longs (méthodologie, mentions). */
export const Etroit: Story = { args: { size: "etroit" } };

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { globals: { theme: "dark" } };
