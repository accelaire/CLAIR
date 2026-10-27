import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { ChambreSwitch, type ChambreSwitchValue } from "../chambre-switch/ChambreSwitch.tsx";
import { MultiSelectFilter } from "../multi-select-filter/MultiSelectFilter.tsx";
import { SearchInput } from "../search-input/SearchInput.tsx";
import { SortSelect } from "../sort-select/SortSelect.tsx";
import { type ActiveFilter, FilterBar, type FilterBarProps } from "./FilterBar.tsx";

const groupes = [
  { value: "EPR", label: "EPR" },
  { value: "RN", label: "RN" },
  { value: "LFI", label: "LFI" },
  { value: "SOC", label: "SOC" },
  { value: "DR", label: "DR" },
  { value: "ECO", label: "ECO" },
];

const tris = [
  { value: "nom", label: "Alphabétique" },
  { value: "presence", label: "Présence" },
];

const chambres: Record<ChambreSwitchValue, string> = {
  "": "Les deux",
  assemblee: "Assemblée nationale",
  senat: "Sénat",
};

type DemoState = { q: string; chambre: ChambreSwitchValue; groupes: string[]; tri: string };

/**
 * Écran d'exemple : l'état des filtres vivrait dans l'URL ; ici, un état local en tient lieu.
 * Les pastilles sont dérivées de cet état.
 */
const Demo = ({ initial, onReset }: { initial: DemoState; onReset: FilterBarProps["onReset"] }) => {
  const [state, setState] = useState(initial);
  const update = (patch: Partial<DemoState>) => setState((current) => ({ ...current, ...patch }));
  const activeFilters: ActiveFilter[] = [
    ...(state.chambre
      ? [
          {
            id: `chambre=${state.chambre}`,
            label: `Chambre : ${chambres[state.chambre]}`,
            onRemove: () => update({ chambre: "" }),
          },
        ]
      : []),
    ...state.groupes.map((groupe) => ({
      id: `groupe=${groupe}`,
      label: `Groupe : ${groupe}`,
      onRemove: () =>
        setState((current) => ({
          ...current,
          groupes: current.groupes.filter((item) => item !== groupe),
        })),
    })),
  ];
  return (
    <FilterBar
      search={
        <SearchInput
          aria-label="Rechercher un parlementaire"
          placeholder="Nom, circonscription…"
          value={state.q}
          onChange={(q) => update({ q })}
        />
      }
      activeFilters={activeFilters}
      onReset={() => {
        setState({ q: "", chambre: "", groupes: [], tri: state.tri });
        onReset?.();
      }}
    >
      <ChambreSwitch value={state.chambre} onChange={(chambre) => update({ chambre })} compact />
      <MultiSelectFilter
        label="Groupes"
        options={groupes}
        value={state.groupes}
        onChange={(value) => update({ groupes: value })}
      />
      <SortSelect value={state.tri} onChange={(tri) => update({ tri })} options={tris} />
    </FilterBar>
  );
};

const vide: DemoState = { q: "", chambre: "", groupes: [], tri: "nom" };
const actifs: DemoState = { q: "", chambre: "assemblee", groupes: ["SOC", "ECO"], tri: "nom" };

const meta = {
  title: "Composants/Filtres/FilterBar",
  component: FilterBar,
  args: { children: null, onReset: fn() },
  render: (args) => <Demo initial={vide} onReset={args.onReset} />,
  argTypes: {
    children: { description: "Filtres de la liste.", table: { category: "Contenu" } },
    search: { description: "Recherche, toujours visible.", table: { category: "Contenu" } },
    activeFilters: {
      description: "Filtres actifs en pastilles retirables.",
      table: { category: "Valeur" },
    },
    activeCount: { description: "Nombre de filtres actifs.", table: { category: "Valeur" } },
    label: { description: "Nom du groupe et titre du tiroir.", table: { category: "Contenu" } },
    onReset: { description: "Réinitialise les filtres.", table: { category: "Événements" } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Barre de filtres : recherche, filtres en ligne (tiroir sur mobile), pastilles retirables, compteur et réinitialisation. Remplace `components/FilterBar.tsx` de apps/web.",
      },
    },
  },
} satisfies Meta<typeof FilterBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

/** Filtres actifs : pastilles retirables et réinitialisation. */
export const FiltresActifs: Story = {
  render: (args) => <Demo initial={actifs} onReset={args.onReset} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Retirer le filtre Groupe : SOC" }));
    await expect(
      canvas.queryByRole("button", { name: "Retirer le filtre Groupe : SOC" }),
    ).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Réinitialiser" }));
    await expect(args.onReset).toHaveBeenCalled();
    await expect(canvas.queryByRole("list", { name: "Filtres actifs" })).toBeNull();
  },
};

/** Sur mobile, le bouton « Filtres » ouvre un tiroir qui se ferme avec Échap. */
export const Mobile: Story = {
  render: (args) => <Demo initial={actifs} onReset={args.onReset} />,
  globals: { viewport: { value: "xs" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("button", { name: /^Filtres\s*, 3 filtres actifs$/ });
    await userEvent.click(toggle);
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole("dialog", { name: "Filtres" })).toBeVisible());
    await expect(body.getByRole("button", { name: "Afficher les résultats" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(toggle).toHaveFocus());
  },
};

export const Sombre: Story = {
  render: (args) => <Demo initial={actifs} onReset={args.onReset} />,
  globals: { theme: "dark" },
};
