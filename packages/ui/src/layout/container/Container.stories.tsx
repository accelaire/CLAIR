import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
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

/** Conteneur rendu par la story : le parent du titre de la page. */
const conteneurDe = (canvasElement: HTMLElement) => {
  const titre = within(canvasElement).getByRole("heading", { level: 1, name: "Titre de la page" });
  const conteneur = titre.parentElement?.parentElement;
  if (!conteneur) throw new Error("Conteneur introuvable");
  return conteneur;
};

/** Largeur du site (`--clair-largeur-contenu`), centrée, sans sémantique propre. */
export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const conteneur = conteneurDe(canvasElement);
    await expect(conteneur.tagName).toBe("DIV");
    await expect(conteneur).toHaveAttribute("data-size", "normal");
    const style = getComputedStyle(conteneur);
    const largeur = getComputedStyle(document.documentElement)
      .getPropertyValue("--clair-largeur-contenu")
      .trim();
    await expect(style.maxWidth).toBe(largeur);
    await expect(style.marginLeft).toBe(style.marginRight);
  },
};

/** Colonne de lecture pour les textes longs (méthodologie, mentions). */
export const Etroit: Story = {
  args: { size: "etroit" },
  play: async ({ canvasElement }) => {
    const conteneur = conteneurDe(canvasElement);
    await expect(conteneur).toHaveAttribute("data-size", "etroit");
    await expect(getComputedStyle(conteneur).maxWidth).toBe("768px");
  },
};

/** Zone nommée : `as="section"` et `aria-labelledby` en font une région de la page. */
export const Section: Story = {
  args: {
    as: "section",
    "aria-labelledby": "titre-section",
    children: (
      <>
        <h2 id="titre-section">Titre de la section</h2>
        <p>Contenu de la section.</p>
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole("region", { name: "Titre de la section" });
    await expect(region.tagName).toBe("SECTION");
  },
};

export const Mobile: Story = { ...Defaut, globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { globals: { theme: "dark" } };
