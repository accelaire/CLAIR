import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { buildDateRangePresets, DateRangePicker } from "./DateRangePicker.tsx";

const empty = { from: null, to: null };

describe("buildDateRangePresets", () => {
  it("propose des périodes glissantes puis les années", () => {
    const presets = buildDateRangePresets({ today: "2026-06-30" });
    expect(presets.map((preset) => preset.label)).toEqual([
      "30 derniers jours",
      "3 derniers mois",
      "12 derniers mois",
      "Année 2026",
      "Année 2025",
      "Année 2024",
    ]);
    expect(presets[0]).toEqual({
      label: "30 derniers jours",
      from: "2026-05-31",
      to: "2026-06-30",
    });
    expect(presets[4]).toEqual({ label: "Année 2025", from: "2025-01-01", to: "2025-12-31" });
  });

  it("part de minDate et propose « depuis le début »", () => {
    const presets = buildDateRangePresets({
      today: "2026-06-30",
      minDate: "2025-10-01",
      startLabel: "Depuis le début du mandat",
    });
    expect(presets[0]).toEqual({
      label: "Depuis le début du mandat",
      from: "2025-10-01",
      to: "2026-06-30",
    });
    expect(presets.at(-1)?.label).toBe("Année 2025");
  });
});

describe("DateRangePicker", () => {
  it("est libellé et affiche la plage en français", () => {
    const { getByRole } = renderWithProviders(
      <DateRangePicker
        value={{ from: "2026-01-05", to: "2026-03-20" }}
        onChange={() => {}}
        maxDate="2026-06-30"
      />,
    );
    const field = getByRole("button", { name: "Période" });
    expect(field).toHaveTextContent("5 janv. 2026 – 20 mars 2026");
  });

  it("applique un raccourci", async () => {
    const onChange = vi.fn();
    const { getByRole } = renderWithProviders(
      <DateRangePicker value={empty} onChange={onChange} maxDate="2026-06-30" />,
    );
    await userEvent.click(getByRole("button", { name: "Période" }));
    await userEvent.click(getByRole("button", { name: "Année 2025", hidden: true }));
    expect(onChange).toHaveBeenCalledWith({ from: "2025-01-01", to: "2025-12-31" });
  });

  it("ne transmet qu'une plage complète et garde la précédente si on abandonne", async () => {
    const onChange = vi.fn();
    const { getByRole } = renderWithProviders(
      <DateRangePicker
        value={{ from: "2026-06-01", to: "2026-06-10" }}
        onChange={onChange}
        maxDate="2026-06-30"
        presets={[]}
      />,
    );
    const field = getByRole("button", { name: "Période" });
    await userEvent.click(field);
    await userEvent.click(getByRole("button", { name: "15 juin 2026", hidden: true }));
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    expect(onChange).not.toHaveBeenCalled();
    expect(field).toHaveTextContent("1 juin 2026 – 10 juin 2026");
  });

  it("choisit deux jours au calendrier", async () => {
    const onChange = vi.fn();
    const { getByRole } = renderWithProviders(
      <DateRangePicker value={empty} onChange={onChange} maxDate="2026-06-30" presets={[]} />,
    );
    await userEvent.click(getByRole("button", { name: "Période" }));
    await userEvent.click(getByRole("button", { name: "3 juin 2026", hidden: true }));
    await userEvent.click(getByRole("button", { name: "12 juin 2026", hidden: true }));
    expect(onChange).toHaveBeenCalledWith({ from: "2026-06-03", to: "2026-06-12" });
  });

  it("s'efface avec le bouton accessible", async () => {
    const onChange = vi.fn();
    const { getByRole } = renderWithProviders(
      <DateRangePicker
        value={{ from: "2026-06-01", to: "2026-06-10" }}
        onChange={onChange}
        maxDate="2026-06-30"
      />,
    );
    await userEvent.click(getByRole("button", { name: "Effacer la période" }));
    expect(onChange).toHaveBeenCalledWith(empty);
  });
});
