import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRight, Download, Share2 } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "./Button.tsx";

const meta = {
  title: "Composants/Fondations/Button",
  component: Button,
  args: { variant: "primaire", size: "md", children: "Télécharger les données", onClick: fn() },
  argTypes: {
    variant: {
      description: "Hiérarchie visuelle : une seule action primaire par zone.",
      control: {
        type: "inline-radio",
        labels: { primaire: "Primaire", secondaire: "Secondaire", tertiaire: "Tertiaire" },
      },
      options: ["primaire", "secondaire", "tertiaire"],
      table: { category: "Apparence" },
    },
    size: {
      description: "Taille du bouton.",
      control: { type: "inline-radio", labels: { sm: "Petit", md: "Moyen", lg: "Grand" } },
      options: ["sm", "md", "lg"],
      table: { category: "Apparence" },
    },
    iconPosition: {
      description: "Position de l'icône par rapport au libellé.",
      control: { type: "inline-radio", labels: { start: "Avant", end: "Après" } },
      options: ["start", "end"],
      table: { category: "Apparence" },
    },
    fullWidth: {
      description: "Occupe toute la largeur disponible.",
      control: "boolean",
      table: { category: "Apparence" },
    },
    loading: {
      description: "Action en cours : le bouton reste focalisable, n'agit plus et l'annonce.",
      control: "boolean",
      table: { category: "État" },
    },
    disabled: { description: "Bouton désactivé.", control: "boolean", table: { category: "État" } },
    children: { description: "Libellé du bouton.", table: { category: "Contenu" } },
    icon: { description: "Icône décorative.", control: false, table: { category: "Contenu" } },
    onClick: { description: "Action déclenchée au clic.", table: { category: "Comportement" } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Bouton d'action. Avec `href`, il rend un lien au même aspect (naviguer n'est pas agir). Une icône seule exige un `aria-label`. Remplace les boutons Tailwind de apps/web.",
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Le bouton déclenche son action au clic. */
export const Defaut: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Télécharger les données" }));
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const Variantes: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <Button {...args} variant="primaire">
        Primaire
      </Button>
      <Button {...args} variant="secondaire">
        Secondaire
      </Button>
      <Button {...args} variant="tertiaire">
        Tertiaire
      </Button>
    </div>
  ),
};

export const Tailles: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <Button {...args} size="sm">
        Petit
      </Button>
      <Button {...args} size="md">
        Moyen
      </Button>
      <Button {...args} size="lg">
        Grand
      </Button>
    </div>
  ),
};

export const AvecIcone: Story = {
  args: { icon: <ArrowRight />, iconPosition: "end", children: "Voir les résultats" },
};

/** Icône seule : le nom accessible vient de l'`aria-label`. */
export const IconeSeule: Story = {
  render: (args) => (
    <Button
      size={args.size}
      variant="secondaire"
      icon={<Share2 />}
      aria-label="Partager la page"
      onClick={args.onClick}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Partager la page" })).toBeVisible();
  },
};

/** Pendant le chargement, le bouton reste focalisable mais n'agit plus. */
export const Chargement: Story = {
  args: { loading: true, icon: <Download />, children: "Téléchargement…" },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Téléchargement…" });
    await expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const Desactive: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Télécharger les données" })).toBeDisabled();
  },
};

/** Avec `href`, le bouton devient un lien. */
export const Lien: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <Button
        variant={args.variant}
        size={args.size}
        href="/soutenir"
        icon={<ArrowRight />}
        iconPosition="end"
      >
        Nous soutenir
      </Button>
      <Button variant="secondaire" size={args.size} href="https://www.senat.fr" external>
        Site du Sénat
      </Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "Nous soutenir" })).toHaveAttribute(
      "href",
      "/soutenir",
    );
    await expect(
      canvas.getByRole("link", { name: "Site du Sénat (nouvelle fenêtre)" }),
    ).toHaveAttribute("target", "_blank");
  },
};

export const PleineLargeur: Story = { args: { fullWidth: true } };

export const Mobile: Story = { ...Variantes, globals: { viewport: { value: "xs" } } };

export const Sombre: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <Button {...args} variant="primaire">
        Primaire
      </Button>
      <Button {...args} variant="secondaire">
        Secondaire
      </Button>
      <Button {...args} variant="tertiaire">
        Tertiaire
      </Button>
      <Button size={args.size} disabled>
        Désactivé
      </Button>
    </div>
  ),
  globals: { theme: "dark" },
};
