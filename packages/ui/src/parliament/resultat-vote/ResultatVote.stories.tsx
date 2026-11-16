import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ResultatVote } from "./ResultatVote.tsx";

const meta = {
  title: "Composants/Parlementaire/ResultatVote",
  component: ResultatVote,
  args: { pour: 312, contre: 205, abstention: 41, label: "Répartition des voix", size: "md" },
  argTypes: {
    pour: { description: "Voix pour (`nombrePour`).", table: { category: "Contenu" } },
    contre: { description: "Voix contre (`nombreContre`).", table: { category: "Contenu" } },
    abstention: {
      description: "Abstentions (`nombreAbstention`).",
      table: { category: "Contenu" },
    },
    label: { description: "Intitulé du graphique.", table: { category: "Contenu" } },
    size: {
      description: "Taille de la barre et de la légende.",
      control: { type: "inline-radio", labels: { sm: "Petit", md: "Moyen" } },
      options: ["sm", "md"],
      table: { category: "Apparence" },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Barre de répartition pour / contre / abstention, toujours doublée de sa légende chiffrée. Remplace les barres en ligne des scrutins et `BarreEtats` de apps/web.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ResultatVote>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Figure légendée par son intitulé (`figcaption`). Le nom n'est pas demandé à `getByRole` :
 * la bibliothèque de test ne le calcule pas depuis `figcaption`, contrairement aux navigateurs.
 */
const figureDe = (canvasElement: HTMLElement, intitule = "Répartition des voix") => {
  const figure = within(canvasElement).getByRole("figure");
  expect(figure.querySelector("figcaption")).toHaveTextContent(intitule);
  return figure;
};

/** Légende de la figure : une ligne par position, valeur et pourcentage en texte. */
const lignesDe = (canvasElement: HTMLElement, intitule?: string) =>
  within(figureDe(canvasElement, intitule)).getAllByRole("listitem");

/**
 * La barre est décorative (masquée aux lecteurs d'écran) ; la légende chiffrée porte
 * l'information, et la mention dit sur quoi sont calculés les pourcentages.
 */
export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const lignes = lignesDe(canvasElement);
    await expect(lignes).toHaveLength(3);
    await expect(lignes[0]).toHaveTextContent(/^Pour\s*312 \(55,9 %\)$/);
    await expect(lignes[1]).toHaveTextContent(/^Contre\s*205 \(36,7 %\)$/);
    await expect(lignes[2]).toHaveTextContent(/^Abstention\s*41 \(7,3 %\)$/);
    const figure = figureDe(canvasElement);
    await expect(figure.querySelector("[aria-hidden='true']")).not.toBeNull();
    await expect(canvas.queryByRole("progressbar")).toBeNull();
    await expect(
      canvas.getByText(
        "Pourcentages calculés par CLAIR sur les votants (pour, contre et abstention).",
      ),
    ).toBeVisible();
  },
};

export const Rejete: Story = {
  args: { pour: 98, contre: 230, abstention: 15 },
  play: async ({ canvasElement }) => {
    await expect(lignesDe(canvasElement)[1]).toHaveTextContent(/^Contre\s*230 \(67,1 %\)$/);
  },
};

export const Egalite: Story = {
  args: { pour: 150, contre: 150, abstention: 3 },
  play: async ({ canvasElement }) => {
    const [pour, contre] = lignesDe(canvasElement);
    await expect(pour).toHaveTextContent(/\(49,5 %\)$/);
    await expect(contre).toHaveTextContent(/\(49,5 %\)$/);
  },
};

/** Aucune voix : ni barre remplie, ni pourcentage (pas de division par zéro). */
export const Vide: Story = {
  args: { pour: 0, contre: 0, abstention: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Aucune voix exprimée.")).toBeVisible();
    await expect(canvas.queryByRole("list")).toBeNull();
    await expect(canvas.queryByText(/%/)).toBeNull();
  },
};

export const Petit: Story = {
  args: { size: "sm", label: "Résultat du scrutin n° 1234" },
  play: async ({ canvasElement }) => {
    await expect(lignesDe(canvasElement, "Résultat du scrutin n° 1234")).toHaveLength(3);
  },
};

export const Mobile: Story = { ...Defaut, globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { ...Defaut, globals: { theme: "dark" } };
