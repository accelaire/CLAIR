import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
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
    orientation: {
      description: "`responsive` : frise horizontale sur grand écran, liste sur mobile.",
      control: { type: "inline-radio" },
      options: ["vertical", "responsive"],
      table: { category: "Structure" },
    },
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

/** Liste des étapes de la frise, nommée par le titre du bloc. */
const etapesDe = (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  const region = canvas.getByRole("region", { name: "Parcours législatif" });
  const liste = within(region).getByRole("list", { name: "Parcours législatif" });
  return within(liste).getAllByRole("listitem");
};

/**
 * L'étape courante est annoncée en texte : phrase de résumé, mention « Étape en cours » lue
 * par les lecteurs d'écran, badge visible et `aria-current="step"`.
 */
export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { level: 2, name: "Parcours législatif" }),
    ).toBeVisible();
    await expect(canvas.getByText(/^Étape en cours : 1re lecture, depuis le /)).toBeVisible();
    const etapes = etapesDe(canvasElement);
    await expect(etapes).toHaveLength(4);
    const courante = etapes.filter((etape) => etape.getAttribute("aria-current") === "step");
    await expect(courante).toEqual([etapes[1]]);
    const enCours = within(etapes[1] as HTMLElement);
    await expect(enCours.getByText("Étape en cours :", { exact: false })).toHaveClass(
      "clair-visually-hidden",
    );
    await expect(enCours.getByText("En cours")).toBeVisible();
    await expect(within(etapes[0] as HTMLElement).getByText("Adopté")).toBeVisible();
    await expect(within(etapes[3] as HTMLElement).getByText("À venir")).toBeVisible();
  },
};

export const Termine: Story = {
  args: { steps: etapesTerminees },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Toutes les étapes sont franchies."),
    ).toBeVisible();
    for (const etape of etapesDe(canvasElement)) {
      await expect(etape).toHaveAttribute("data-status", "done");
      await expect(etape).not.toHaveAttribute("aria-current");
    }
    await expect(within(canvasElement).getByText("Partiellement conforme")).toBeVisible();
  },
};

export const Navette: Story = {
  args: { steps: etapesNavette },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/^Étape en cours : Nouvelle lecture/)).toBeVisible();
    await expect(canvas.getByText("Désaccord")).toBeVisible();
    await expect(canvas.getAllByText("À venir")).toHaveLength(2);
  },
};

export const Vide: Story = {
  args: { steps: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Aucune étape connue pour ce dossier")).toBeVisible();
    await expect(canvas.queryByRole("list")).toBeNull();
  },
};

export const Mobile: Story = { ...Navette, globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { ...Termine, globals: { theme: "dark" } };

/** Frise horizontale sur grand écran (fiche d'un sujet, comme dans apps/web), liste sur mobile. */
export const Horizontale: Story = {
  args: { steps: etapesNavette, orientation: "responsive" },
  parameters: { layout: "fullscreen" },
  play: async ({ canvasElement }) => {
    const etapes = etapesDe(canvasElement);
    await expect(etapes).toHaveLength(etapesNavette.length);
    await expect(etapes[0]).toHaveTextContent(/^Étape franchie :/);
  },
};

export const HorizontaleMobile: Story = {
  ...Horizontale,
  globals: { viewport: { value: "xs" } },
};
