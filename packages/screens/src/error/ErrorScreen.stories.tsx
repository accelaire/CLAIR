import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ErrorScreen } from "./ErrorScreen.tsx";

const meta = {
  title: "Écrans/Erreur",
  component: ErrorScreen,
  args: { onRetry: fn() },
  argTypes: {
    onRetry: {
      description:
        "Nouvelle tentative de chargement ; sans elle, le bouton « Réessayer » disparaît.",
      table: { category: "Événements" },
    },
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Page d'erreur du site (`error.tsx`) : message, nouvelle tentative et retour à l'accueil. Sans appel à l'API.",
      },
    },
  },
} satisfies Meta<typeof ErrorScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  play: async ({ args, canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.getByRole("alert")).toBeInTheDocument();
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Une erreur est survenue",
    );
    await userEvent.click(ecran.getByRole("button", { name: "Réessayer" }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
  },
};

export const SansNouvelleTentative: Story = {
  args: { onRetry: undefined },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    await expect(ecran.queryByRole("button", { name: "Réessayer" })).toBeNull();
    await expect(ecran.getByRole("link", { name: "Revenir à l'accueil" })).toHaveAttribute(
      "href",
      "/",
    );
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
