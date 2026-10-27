import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Faq } from "./Faq.tsx";
import { questionsExemple } from "./fixtures.ts";

const meta = {
  title: "Composants/Fondations/Faq",
  component: Faq,
  args: { items: questionsExemple, multiple: false, headingLevel: 3 },
  argTypes: {
    items: { description: "Questions et réponses.", table: { category: "Contenu" } },
    multiple: {
      description: "Plusieurs réponses ouvertes en même temps.",
      control: "boolean",
      table: { category: "Comportement" },
    },
    defaultOpened: {
      description: "Positions des questions ouvertes au premier rendu.",
      table: { category: "Comportement" },
    },
    headingLevel: {
      description: "Niveau de titre des questions.",
      control: { type: "select" },
      options: [2, 3, 4, 5, 6],
      table: { category: "Accessibilité" },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Foire aux questions en accordéon. Remplace `FAQAccordion` de apps/web (sans framer-motion).",
      },
    },
  },
} satisfies Meta<typeof Faq>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const UnOuvert: Story = { args: { defaultOpened: [0] } };

/** Ouvrir une question referme la précédente. */
export const Clavier: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const premiere = canvas.getByRole("button", { name: "D'où viennent les données ?" });
    const deuxieme = canvas.getByRole("button", { name: "Les résumés sont-ils officiels ?" });
    await userEvent.tab();
    await expect(premiere).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(premiere).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(canvas.getByText(/données ouvertes/)).toBeVisible());
    await userEvent.click(deuxieme);
    await expect(deuxieme).toHaveAttribute("aria-expanded", "true");
    await expect(premiere).toHaveAttribute("aria-expanded", "false");
  },
};

/** Avec `multiple`, les réponses restent ouvertes. */
export const Multiple: Story = {
  args: { multiple: true, defaultOpened: [0] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Comment signaler une erreur ?" }));
    await expect(
      canvas.getByRole("button", { name: "D'où viennent les données ?" }),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(
      canvas.getByRole("button", { name: "Comment signaler une erreur ?" }),
    ).toHaveAttribute("aria-expanded", "true");
  },
};

export const Mobile: Story = {
  args: { defaultOpened: [1] },
  globals: { viewport: { value: "xs" } },
};

export const Sombre: Story = { args: { defaultOpened: [0] }, globals: { theme: "dark" } };
