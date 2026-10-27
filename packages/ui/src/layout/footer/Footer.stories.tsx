import type { Meta, StoryObj } from "@storybook/react-vite";
import { Footer } from "./Footer.tsx";
import { footerExemple } from "./fixtures.ts";

const meta = {
  title: "Composants/Mise en page/Footer",
  component: Footer,
  args: footerExemple,
  argTypes: {
    columns: {
      description: "Colonnes de liens, chacune avec un titre.",
      table: { category: "Contenu" },
    },
    sources: { description: "Producteurs des données affichées.", table: { category: "Contenu" } },
    tagline: { description: "Phrase sous la marque.", table: { category: "Contenu" } },
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "Pied de page : colonnes de liens, réseaux et sources des données.",
      },
    },
  },
} satisfies Meta<typeof Footer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};
export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
