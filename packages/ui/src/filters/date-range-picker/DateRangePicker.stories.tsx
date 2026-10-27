import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
  buildDateRangePresets,
  DateRangePicker,
  type DateRangePickerProps,
  type DateRangePreset,
} from "./DateRangePicker.tsx";

/** Date de référence fixe : les stories ne dépendent pas du jour où elles sont rendues. */
const today = "2026-06-30";

/** Périodes institutionnelles, telles que les produit `toPeriodePresets` (apps/web lib/periodes.ts). */
const periodes: DateRangePreset[] = [
  { label: "XVIIe législature", from: "2024-07-18", to: today },
  { label: "Session 2025-2026", from: "2025-10-01", to: today },
  { label: "Session 2024-2025", from: "2024-10-01", to: "2025-09-30" },
];

/** Rend la plage contrôlée, comme un écran qui synchronise la valeur avec l'URL. */
const Controlled = (args: DateRangePickerProps) => {
  const [value, setValue] = useState(args.value);
  return (
    <div style={{ maxWidth: 320 }}>
      <DateRangePicker
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
  title: "Composants/Filtres/DateRangePicker",
  component: DateRangePicker,
  render: Controlled,
  args: { value: { from: null, to: null }, onChange: fn(), maxDate: today },
  argTypes: {
    label: { description: "Libellé du champ.", table: { category: "Contenu" } },
    hideLabel: { description: "Masque visuellement le libellé.", table: { category: "Apparence" } },
    value: {
      description: "Plage choisie, bornes au format `YYYY-MM-DD` (contrôlée).",
      table: { category: "Valeur" },
    },
    presets: { description: "Raccourcis proposés.", table: { category: "Contenu" } },
    minDate: { description: "Date la plus ancienne.", table: { category: "Comportement" } },
    maxDate: { description: "Date la plus récente.", table: { category: "Comportement" } },
    placeholder: { description: "Texte sans plage choisie.", table: { category: "Contenu" } },
    disabled: { description: "Champ désactivé.", table: { category: "États" } },
    onChange: {
      description: "Appelé avec une plage complète ou à l'effacement.",
      table: { category: "Événements" },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Choix d'une plage de dates (`@mantine/dates`, locale française) avec raccourcis. Remplace `components/DateRangePicker.tsx` de apps/web. L'application doit charger `@mantine/dates/styles.css`.",
      },
    },
  },
} satisfies Meta<typeof DateRangePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

export const Plage: Story = { args: { value: { from: "2026-01-05", to: "2026-03-20" } } };

/** Raccourcis glissants, depuis le début du mandat et périodes institutionnelles. */
export const Preselections: Story = {
  args: {
    minDate: "2024-07-18",
    presets: [
      ...buildDateRangePresets({
        today,
        minDate: "2024-07-18",
        startLabel: "Depuis le début du mandat",
      }),
      ...periodes,
    ],
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Période" }));
    const body = within(canvasElement.ownerDocument.body);
    const preset = await waitFor(() => {
      const button = body.getByRole("button", { name: "XVIIe législature" });
      expect(button).toBeVisible();
      return button;
    });
    await userEvent.click(preset);
    await expect(args.onChange).toHaveBeenCalledWith({ from: "2024-07-18", to: today });
  },
};

export const SansRaccourcis: Story = { args: { presets: [] } };

export const Desactive: Story = {
  args: { disabled: true, value: { from: "2026-01-05", to: "2026-03-20" } },
};

/** Ouverture du calendrier et abandon par Échap : la plage précédente est conservée. */
export const Abandon: Story = {
  args: { value: { from: "2026-06-01", to: "2026-06-10" }, presets: [] },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole("button", { name: "Période" });
    await userEvent.click(field);
    const body = within(canvasElement.ownerDocument.body);
    const day = await waitFor(() => {
      const button = body.getByRole("button", { name: "15 juin 2026" });
      expect(button).toBeVisible();
      return button;
    });
    await userEvent.click(day);
    await userEvent.keyboard("{Escape}");
    await expect(args.onChange).not.toHaveBeenCalled();
    await expect(field).toHaveTextContent("1 juin 2026 – 10 juin 2026");
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };

export const Sombre: Story = {
  args: { value: { from: "2026-01-05", to: "2026-03-20" } },
  globals: { theme: "dark" },
};
