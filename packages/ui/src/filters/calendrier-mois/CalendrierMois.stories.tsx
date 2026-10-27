import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
  type CalendrierJour,
  CalendrierMois,
  type CalendrierMoisProps,
} from "./CalendrierMois.tsx";

/** Réunions d'exemple, par jour : les stories ne dépendent pas du jour où elles sont rendues. */
const reunions: Record<string, number> = {
  "2026-10-06": 1,
  "2026-10-07": 3,
  "2026-10-13": 6,
  "2026-10-14": 2,
  "2026-10-21": 4,
};

const point = (nombre: number) => (
  <span
    style={{
      display: "inline-block",
      width: nombre > 4 ? 12 : 8,
      height: 8,
      borderRadius: 999,
      background: "currentColor",
    }}
  />
);

/** Ce que fait l'agenda : le libellé dit le nombre de réunions, que les points montrent. */
const getJour = (jour: string): CalendrierJour => {
  const nombre = reunions[jour] ?? 0;
  const date = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${jour}T12:00:00Z`));
  return {
    label: `${date}, ${nombre > 0 ? `${nombre} réunion${nombre > 1 ? "s" : ""}` : "aucune réunion"}`,
    marques: nombre > 0 ? point(nombre) : null,
    periode: jour >= "2026-10-26",
  };
};

/** Rend le mois et la sélection contrôlés, comme un écran qui les écrit dans l'URL. */
const Controlled = (args: CalendrierMoisProps) => {
  const [mois, setMois] = useState(args.mois);
  const [selection, setSelection] = useState(args.selection ?? null);
  return (
    <div style={{ maxWidth: 420 }}>
      <CalendrierMois
        {...args}
        mois={mois}
        selection={selection}
        onMoisChange={(next) => {
          setMois(next);
          args.onMoisChange(next);
        }}
        onSelect={(jour) => {
          setSelection(jour);
          args.onSelect(jour);
        }}
      />
    </div>
  );
};

const meta = {
  title: "Composants/Filtres/CalendrierMois",
  component: CalendrierMois,
  render: Controlled,
  args: {
    mois: "2026-10",
    aujourdhui: "2026-10-14",
    onMoisChange: fn(),
    onSelect: fn(),
    getJour,
  },
  argTypes: {
    mois: { description: "Mois affiché, `YYYY-MM`.", table: { category: "Contenu" } },
    selection: { description: "Jour choisi, `YYYY-MM-DD`.", table: { category: "Contenu" } },
    aujourdhui: {
      description: "Jour d'aujourd'hui, calculé par l'écran (fuseau de Paris).",
      table: { category: "Contenu" },
    },
    getJour: {
      description: "Libellé complet, marques et période de chaque jour.",
      table: { category: "Contenu" },
    },
    onMoisChange: { description: "Changement de mois.", table: { category: "Événements" } },
    onSelect: { description: "Choix d'un jour.", table: { category: "Événements" } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Calendrier d'un mois (`@mantine/dates`) dont chaque jour dit en toutes lettres ce que montrent ses marques. Remplace la grille de `MonthCalendar` de apps/web (agenda).",
      },
    },
  },
} satisfies Meta<typeof CalendrierMois>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const AvecSelection: Story = { args: { selection: "2026-10-07" } };

/** Sans marques ni libellés : chaque jour s'appelle par sa date en toutes lettres. */
export const Nu: Story = { args: { getJour: undefined } };

/** Flèches pour se déplacer, Entrée pour choisir, boutons nommés pour changer de mois. */
export const Clavier: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const jour = canvas.getByRole("button", { name: "mercredi 14 octobre, 2 réunions" });
    jour.focus();
    await userEvent.keyboard("{ArrowRight}");
    const suivant = canvas.getByRole("button", { name: "jeudi 15 octobre, aucune réunion" });
    await waitFor(() => expect(suivant).toHaveFocus());
    await userEvent.keyboard("{Enter}");
    await expect(args.onSelect).toHaveBeenCalledWith("2026-10-15");
    await expect(suivant).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(canvas.getByRole("button", { name: "Mois suivant" }));
    await expect(args.onMoisChange).toHaveBeenCalledWith("2026-11");
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { args: { selection: "2026-10-07" }, globals: { theme: "dark" } };
