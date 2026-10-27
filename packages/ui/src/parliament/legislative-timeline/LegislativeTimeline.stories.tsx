import type { Meta, StoryObj } from "@storybook/react-vite";
import { etapesEnCours, etapesNavette, etapesTerminees } from "../timeline-fixtures.ts";
import { LegislativeTimeline } from "./LegislativeTimeline.tsx";

const meta = {
  title: "Composants/Parlementaire/LegislativeTimeline",
  component: LegislativeTimeline,
  args: { steps: etapesEnCours },
  argTypes: {
    steps: {
      description: "Étapes du dossier (forme de l'API) : franchies, en cours, à venir.",
      table: { category: "Données" },
    },
    title: { description: "Titre du bloc.", table: { category: "Contenu" } },
    headingLevel: {
      description: "Niveau du titre dans la page.",
      control: { type: "inline-radio" },
      options: [2, 3, 4],
      table: { category: "Structure" },
    },
    children: { description: "Contenu ajouté sous la frise.", table: { category: "Contenu" } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Parcours d'un dossier législatif : étapes franchies, en cours, à venir, avec chambre, date et issue officielle. L'étape courante est annoncée en texte. Remplace `LegislativeTimeline` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof LegislativeTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const Termine: Story = { args: { steps: etapesTerminees } };

export const Navette: Story = { args: { steps: etapesNavette } };

export const Vide: Story = { args: { steps: [] } };

export const Mobile: Story = {
  args: { steps: etapesNavette },
  globals: { viewport: { value: "xs" } },
};

export const Sombre: Story = { args: { steps: etapesTerminees }, globals: { theme: "dark" } };
