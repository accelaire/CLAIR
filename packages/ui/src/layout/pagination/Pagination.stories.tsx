import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { Pagination } from "./Pagination.tsx";

const hrefFor = (page: number) => (page === 1 ? "/scrutins" : `/scrutins?page=${page}`);

const meta = {
  title: "Composants/Mise en page/Pagination",
  component: Pagination,
  args: { page: 6, total: 20, hrefFor },
  argTypes: {
    page: {
      description: "Page courante, à partir de 1.",
      control: { type: "number", min: 1 },
      table: { category: "État" },
    },
    total: {
      description: "Nombre total de pages.",
      control: { type: "number", min: 1 },
      table: { category: "Contenu" },
    },
    siblings: {
      description: "Pages voisines affichées autour de la page courante.",
      control: { type: "number", min: 0 },
      table: { category: "Apparence" },
    },
    label: { description: "Nom accessible de la navigation.", table: { category: "Contenu" } },
    hrefFor: {
      description: "Adresse d'une page : les pages sont des liens (à préférer).",
      control: false,
      table: { category: "Navigation" },
    },
    onChange: {
      description: "Changement de page sans changer d'adresse : les pages sont des boutons.",
      control: false,
      table: { category: "Événements" },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Pagination en liens (référencement) ou en boutons, page courante signalée, version compacte sur mobile. Remplace `components/Pagination.tsx` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const Debut: Story = { args: { page: 1 } };

export const Milieu: Story = { args: { page: 10 } };

export const Fin: Story = { args: { page: 20 } };

export const PeuDePages: Story = { args: { page: 2, total: 4 } };

/** Pagination en boutons, sans changement d'adresse (liste chargée dans la page). */
export const EnBoutons: Story = {
  args: { hrefFor: undefined },
  render: ({ total }) => {
    const [page, setPage] = useState(1);
    return <Pagination page={page} total={total} onChange={setPage} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Précédent" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "Page 2" }));
    await expect(canvas.getByRole("button", { name: "Page 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Suivant" }));
    await expect(canvas.getByRole("button", { name: "Page 3" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  },
};

/** Sur un écran étroit, seuls « Précédent », « Page n sur N » et « Suivant » restent. */
export const Mobile: Story = {
  globals: { viewport: { value: "xs" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Page 6 sur 20")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Suivant" })).toBeVisible();
  },
};

export const Sombre: Story = { globals: { theme: "dark" } };
