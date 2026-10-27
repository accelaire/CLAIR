import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { SearchInput, type SearchInputProps } from "./SearchInput.tsx";

/** Rend le champ contrôlé, comme un écran qui synchronise la valeur avec l'URL. */
const Controlled = (args: SearchInputProps) => {
  const [value, setValue] = useState(args.value);
  return (
    <div style={{ maxWidth: 420 }}>
      <SearchInput
        {...args}
        value={value}
        onChange={(next) => {
          setValue(next);
          args.onChange(next);
        }}
      />
    </div>
  );
};

const meta = {
  title: "Composants/Filtres/SearchInput",
  component: SearchInput,
  render: Controlled,
  args: {
    label: "Rechercher un parlementaire",
    value: "",
    placeholder: "Nom, circonscription…",
    onChange: fn(),
    onSubmit: fn(),
  },
  argTypes: {
    label: { description: "Libellé visible du champ.", table: { category: "Contenu" } },
    value: { description: "Texte recherché (contrôlé).", table: { category: "Valeur" } },
    placeholder: { description: "Exemple de saisie.", table: { category: "Contenu" } },
    description: { description: "Aide sous le champ.", table: { category: "Contenu" } },
    debounceMs: {
      description: "Délai de regroupement des frappes avant `onChange` (ms).",
      control: { type: "number", min: 0, step: 50 },
      table: { category: "Comportement" },
    },
    disabled: { description: "Champ désactivé.", table: { category: "États" } },
    onChange: {
      description: "Appelé à chaque saisie (ou après le délai).",
      table: { category: "Événements" },
    },
    onSubmit: {
      description: "Appelé à la validation par Entrée.",
      table: { category: "Événements" },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Champ de recherche contrôlé avec bouton d'effacement, validation par Entrée et regroupement optionnel des frappes. Remplace `.search-input` et le champ de la page de recherche de apps/web.",
      },
    },
  },
} satisfies Meta<typeof SearchInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const Saisie: Story = {
  args: { value: "Camille Exemple" },
};

/** Libellé implicite : le nom accessible passe par `aria-label`. */
export const SansLibelleVisible: Story = {
  args: {
    label: undefined,
    "aria-label": "Rechercher dans les scrutins",
    placeholder: "Rechercher…",
  },
};

export const AvecDescription: Story = {
  args: { description: "Au moins deux caractères." },
};

export const Desactive: Story = { args: { disabled: true, value: "Camille" } };

/** Saisie, validation par Entrée puis effacement au bouton : le focus revient dans le champ. */
export const Interaction: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole("searchbox", { name: "Rechercher un parlementaire" });
    await userEvent.type(field, "Camille{Enter}");
    await expect(args.onSubmit).toHaveBeenCalledWith("Camille");
    await userEvent.click(canvas.getByRole("button", { name: "Effacer la recherche" }));
    await expect(field).toHaveValue("");
    await expect(field).toHaveFocus();
  },
};

/** Avec un délai, `onChange` n'est appelé qu'une fois la frappe arrêtée. */
export const AvecDelai: Story = {
  args: { debounceMs: 300 },
  play: async ({ args, canvasElement }) => {
    const field = within(canvasElement).getByRole("searchbox");
    await userEvent.type(field, "loi");
    await waitFor(() => expect(args.onChange).toHaveBeenCalledWith("loi"));
    await expect(args.onChange).toHaveBeenCalledTimes(1);
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { args: { value: "Camille Exemple" }, globals: { theme: "dark" } };
