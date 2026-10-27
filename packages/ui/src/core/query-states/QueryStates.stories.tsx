import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { EmptyState, ErrorState, LoadingState } from "./QueryStates.tsx";

const meta = {
  title: "Composants/Fondations/QueryStates",
  component: LoadingState,
  args: { label: "Chargement des scrutins…", variant: "loader", lines: 3 },
  argTypes: {
    label: {
      description: "Message annoncé aux lecteurs d'écran.",
      table: { category: "Contenu" },
    },
    variant: {
      description: "Indicateur rotatif avec message, ou lignes fantômes.",
      control: { type: "inline-radio", labels: { loader: "Indicateur", skeleton: "Squelette" } },
      options: ["loader", "skeleton"],
      table: { category: "Apparence" },
    },
    lines: {
      description: "Nombre de lignes fantômes.",
      control: { type: "number", min: 1, max: 10 },
      if: { arg: "variant", eq: "skeleton" },
      table: { category: "Apparence" },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "États d'un écran qui charge des données : chargement (`LoadingState`), erreur récupérable (`ErrorState`) et vide (`EmptyState`). Remplace les états ad hoc de chaque PageClient de apps/web.",
      },
    },
  },
} satisfies Meta<typeof LoadingState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const Chargement: Story = {};

export const Squelette: Story = { args: { variant: "skeleton", lines: 4 } };

/** Le bouton « Réessayer » relance la requête. */
export const Erreur: Story = {
  render: () => <ErrorState onRetry={fn()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent("Le chargement a échoué");
    const button = canvas.getByRole("button", { name: "Réessayer" });
    await userEvent.tab();
    await expect(button).toHaveFocus();
  },
};

export const ErreurSansReessai: Story = {
  render: () => (
    <ErrorState
      title="Page indisponible"
      message="Cette fiche n'est plus disponible pour le moment."
    />
  ),
};

export const Vide: Story = {
  render: () => (
    <EmptyState
      title="Aucun scrutin trouvé"
      description="Aucun scrutin ne correspond à ces filtres."
      action={
        <button type="button" onClick={fn()}>
          Effacer les filtres
        </button>
      }
    />
  ),
};

export const Mobile: Story = {
  render: () => <ErrorState onRetry={fn()} />,
  globals: { viewport: { value: "xs" } },
};

export const Sombre: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 24 }}>
      <LoadingState label="Chargement des scrutins…" />
      <LoadingState label="Chargement des scrutins…" variant="skeleton" />
      <ErrorState onRetry={fn()} />
      <EmptyState title="Aucun scrutin trouvé" description="Essayez d'autres filtres." />
    </div>
  ),
  globals: { theme: "dark" },
};
