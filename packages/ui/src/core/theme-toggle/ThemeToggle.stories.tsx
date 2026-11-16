import { cssVariablesResolver, theme } from "@clair/theme";
import {
  type MantineColorScheme,
  type MantineColorSchemeManager,
  MantineProvider,
} from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { attendreFocusVisible } from "../../story-utils.ts";
import { ThemeToggle } from "./ThemeToggle.tsx";

const meta = {
  title: "Composants/Fondations/ThemeToggle",
  component: ThemeToggle,
  parameters: {
    docs: { description: { component: "Bouton de bascule entre les thèmes clair et sombre." } },
  },
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Thème clair : le bouton propose le thème sombre, il est atteint à la tabulation. */
export const Defaut: Story = {
  play: async ({ canvasElement }) => {
    const bouton = within(canvasElement).getByRole("button", { name: "Passer au thème sombre" });
    await userEvent.tab();
    await attendreFocusVisible(bouton);
  },
};

/**
 * Gestionnaire de thème en mémoire : la story bascule sans toucher au `localStorage` du
 * navigateur ni au thème imposé par l'atelier.
 */
const gestionnaireEnMemoire = (): MantineColorSchemeManager => {
  let valeur: MantineColorScheme = "light";
  return {
    get: () => valeur,
    set: (suivante) => {
      valeur = suivante;
    },
    subscribe: () => {},
    unsubscribe: () => {},
    clear: () => {
      valeur = "light";
    },
  };
};

/**
 * Fournisseur Mantine dont le thème n'est pas imposé, pour que le bouton puisse basculer.
 * L'attribut `data-mantine-color-scheme` est posé sur un conteneur local, pas sur la page.
 */
const Bascule = () => {
  const racine = useRef<HTMLDivElement>(null);
  const gestionnaire = useRef(gestionnaireEnMemoire());
  return (
    <div ref={racine} data-testid="racine-theme">
      <MantineProvider
        theme={theme}
        cssVariablesResolver={cssVariablesResolver}
        colorSchemeManager={gestionnaire.current}
        defaultColorScheme="light"
        getRootElement={() => racine.current ?? undefined}
        withCssVariables={false}
        withGlobalClasses={false}
      >
        <ThemeToggle />
      </MantineProvider>
    </div>
  );
};

/** Entrée puis Espace basculent le thème : le nom du bouton annonce toujours l'action suivante. */
export const BasculeAuClavier: Story = {
  render: () => <Bascule />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const racine = canvas.getByTestId("racine-theme");
    await userEvent.tab();
    const bouton = canvas.getByRole("button", { name: "Passer au thème sombre" });
    await attendreFocusVisible(bouton);
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(bouton).toHaveAccessibleName("Passer au thème clair"));
    await expect(racine).toHaveAttribute("data-mantine-color-scheme", "dark");
    await expect(bouton).toHaveFocus();
    await userEvent.keyboard(" ");
    await waitFor(() => expect(bouton).toHaveAccessibleName("Passer au thème sombre"));
    await expect(racine).toHaveAttribute("data-mantine-color-scheme", "light");
    await userEvent.click(bouton);
    await waitFor(() => expect(bouton).toHaveAccessibleName("Passer au thème clair"));
  },
};

export const Mobile: Story = { ...Defaut, globals: { viewport: { value: "xs" } } };

/** Thème sombre : le bouton propose le thème clair. */
export const Sombre: Story = {
  globals: { theme: "dark" },
  play: async ({ canvasElement }) => {
    const bouton = within(canvasElement).getByRole("button", { name: "Passer au thème clair" });
    await userEvent.tab();
    await attendreFocusVisible(bouton);
  },
};
