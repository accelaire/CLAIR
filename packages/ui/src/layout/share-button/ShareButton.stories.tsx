import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ShareButton } from "./ShareButton.tsx";

/**
 * Simule un navigateur sans partage natif et un presse-papier contrôlé : Chromium proposerait
 * sinon sa feuille de partage, et l'accès au presse-papier dépend des permissions.
 */
const pressePapier = (copie: "reussie" | "echouee") => () => {
  const writeText =
    copie === "reussie" ? fn().mockResolvedValue(undefined) : fn().mockRejectedValue(new Error());
  Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return () => {
    Reflect.deleteProperty(navigator, "share");
    Reflect.deleteProperty(navigator, "clipboard");
  };
};

const meta = {
  title: "Composants/Mise en page/ShareButton",
  component: ShareButton,
  args: { url: "https://clair.vote/scrutins/1234", label: "Partager", iconOnly: false },
  argTypes: {
    url: {
      description: "Adresse à partager (la page courante par défaut).",
      table: { category: "Contenu" },
    },
    title: { description: "Titre transmis au partage natif.", table: { category: "Contenu" } },
    text: { description: "Texte transmis au partage natif.", table: { category: "Contenu" } },
    label: { description: "Libellé du bouton.", table: { category: "Contenu" } },
    iconOnly: {
      description: "Icône seule ; le libellé reste le nom accessible.",
      control: "boolean",
      table: { category: "Apparence" },
    },
  },
  beforeEach: pressePapier("reussie"),
  parameters: {
    docs: {
      description: {
        component:
          "Partage natif (Web Share API) si disponible, sinon copie du lien avec confirmation annoncée. Remplace `components/ShareButton.tsx` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof ShareButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const IconeSeule: Story = { args: { iconOnly: true } };

/** Sans partage natif, le lien est copié ; la confirmation est visible et annoncée. */
export const Copie: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Partager" }));
    await expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://clair.vote/scrutins/1234",
    );
    await expect(await canvas.findByRole("button", { name: "Lien copié" })).toBeVisible();
    await expect(canvas.getByText("Lien copié dans le presse-papier.")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  },
};

/** La copie échoue : le lien est affiché pour être copié à la main. */
export const Erreur: Story = {
  beforeEach: pressePapier("echouee"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Partager" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "https://clair.vote/scrutins/1234",
    );
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { ...Copie, globals: { theme: "dark" } };
