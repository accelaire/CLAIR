---
name: clair-story
description: Write Storybook stories (CSF3, Storybook 10) for a CLAIR component following the conventions adapted from the DINUM Storybooks (French titles and argTypes, Defaut story, states, mobile and dark variants). Use when creating or updating a *.stories.tsx file in packages/ui or packages/screens.
---

# CLAIR — écrire des stories

Conventions reprises des Storybook de la DINUM (`dsfr-sb`, `react-dsfr`) et adaptées à React + Storybook 10.

## Structure

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./Badge.tsx";

const meta = {
  title: "Composants/Fondations/Badge",
  component: Badge,
  args: { tone: "neutre", children: "Adopté" },
  argTypes: {
    tone: {
      description: "Ton du badge. La couleur est toujours doublée d'un libellé.",
      control: { type: "select", labels: { neutre: "Neutre", info: "Information" } },
      options: ["neutre", "info", "succes", "erreur", "avertissement"],
      table: { category: "Apparence" },
    },
  },
  parameters: {
    docs: { description: { component: "Étiquette de statut. Remplace `.badge-*` de apps/web." } },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};
export const Tons: Story = { render: () => (<>{/* une occurrence par ton */}</>) };
export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
```

## Règles

- **Titre** : `Composants/<Famille>/<Nom>` (familles : Fondations, Mise en page, Filtres, Parlementaire, Graphiques) ; écrans : `Écrans/<Nom>`.
- **Story `Defaut` obligatoire** (le test du catalogue la cherche) ; noms d'export en français sans accent (`Defaut`, `Desactive`, `Chargement`, `Vide`, `Erreur`).
- **États** dès qu'ils existent : `Chargement`, `Vide`, `Erreur`, `Desactive` ; **`Mobile`** (viewport `xs`) ; **`Sombre`** si le rendu change.
- **argTypes** en français : `description`, `table.category`, `control.labels` ; `if: { arg, eq }` pour une prop conditionnelle.
- **Interaction** : une fonction `play` (`userEvent`, `expect` de `storybook/test`) pour tout comportement (ouvrir, filtrer, naviguer au clavier).
- **Données** : fixtures typées de `@clair/data` (jamais d'appel réseau, jamais de données inventées présentées comme réelles).
- **Accessibilité** : l'addon a11y est en mode erreur ; une story ne doit produire aucune violation. Ne jamais désactiver une règle sans justification écrite dans `parameters.a11y`.
