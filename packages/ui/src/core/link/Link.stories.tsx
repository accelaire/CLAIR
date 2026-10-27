import type { Meta, StoryObj } from "@storybook/react-vite";
import { Link } from "./Link.tsx";

const meta = {
  title: "Composants/Fondations/Link",
  component: Link,
  args: { href: "/deputes", children: "Voir les députés", external: false },
  argTypes: {
    href: { description: "Adresse du lien.", table: { category: "Contenu" } },
    external: {
      description: "Lien vers un autre site : nouvel onglet, annoncé aux lecteurs d'écran.",
      control: "boolean",
      table: { category: "Comportement" },
    },
    children: {
      description: "Texte du lien, explicite hors contexte.",
      table: { category: "Contenu" },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Lien de texte rendu par le routeur de l'application. Remplace les `next/link` des composants.",
      },
    },
  },
} satisfies Meta<typeof Link>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const Externe: Story = {
  args: {
    href: "https://www.assemblee-nationale.fr",
    external: true,
    children: "Site de l'Assemblée nationale",
  },
};

export const Sombre: Story = { globals: { theme: "dark" } };
