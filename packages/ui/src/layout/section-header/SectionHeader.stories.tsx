import type { Meta, StoryObj } from "@storybook/react-vite";
import { SectionHeader } from "./SectionHeader.tsx";

const meta = {
  title: "Composants/Mise en page/SectionHeader",
  component: SectionHeader,
  args: { title: "Scrutins récents", level: 2 },
  argTypes: {
    title: { description: "Titre de la section.", table: { category: "Contenu" } },
    level: {
      description: "Niveau du titre selon la hiérarchie de la page.",
      control: { type: "inline-radio", labels: { 2: "h2", 3: "h3" } },
      options: [2, 3],
      table: { category: "Sémantique" },
    },
    description: { description: "Phrase sous le titre.", table: { category: "Contenu" } },
    seeAllHref: { description: "Lien vers la liste complète.", table: { category: "Navigation" } },
    seeAllLabel: {
      description: "Libellé visible du lien (« Voir tout » par défaut).",
      table: { category: "Navigation" },
    },
    id: { description: "Identifiant du titre (ancre).", table: { category: "Sémantique" } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Titre de section (h2 ou h3), description et lien « Voir tout » optionnels. Remplace les titres de section écrits à la main dans apps/web.",
      },
    },
  },
} satisfies Meta<typeof SectionHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const AvecDescription: Story = {
  args: { description: "Les derniers votes publics de l'Assemblée nationale et du Sénat." },
};

export const AvecLienVoirTout: Story = {
  args: {
    description: "Les derniers votes publics de l'Assemblée nationale et du Sénat.",
    seeAllHref: "/scrutins",
  },
};

export const NiveauTrois: Story = { args: { title: "Amendements déposés", level: 3 } };

export const Mobile: Story = { ...AvecLienVoirTout, globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { ...AvecLienVoirTout, globals: { theme: "dark" } };
