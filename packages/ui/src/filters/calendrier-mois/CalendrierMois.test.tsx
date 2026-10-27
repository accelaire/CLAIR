import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { CalendrierMois } from "./CalendrierMois.tsx";

describe("CalendrierMois", () => {
  it("affiche le mois en français, semaine du lundi, et nomme chaque jour en entier", () => {
    const { getAllByRole, getByRole } = renderWithProviders(
      <CalendrierMois mois="2026-10" onMoisChange={() => {}} onSelect={() => {}} />,
    );
    const entetes = getAllByRole("columnheader").map((th) => th.textContent?.toLowerCase());
    expect(entetes[0]).toMatch(/^lu/);
    expect(getByRole("button", { name: "jeudi 1 octobre 2026" })).toBeInTheDocument();
    expect(getAllByRole("button", { name: /octobre 2026$/ })).toHaveLength(31);
  });

  it("donne à chaque jour le libellé de l'écran et signale la sélection et aujourd'hui", () => {
    const { getByRole } = renderWithProviders(
      <CalendrierMois
        mois="2026-10"
        onMoisChange={() => {}}
        onSelect={() => {}}
        selection="2026-10-14"
        aujourdhui="2026-10-20"
        getJour={(jour) =>
          jour === "2026-10-14"
            ? { label: "mercredi 14 octobre, 3 réunions", periode: true, marques: <i>•</i> }
            : {}
        }
      />,
    );
    const jour = getByRole("button", { name: "mercredi 14 octobre, 3 réunions" });
    expect(jour).toHaveAttribute("aria-pressed", "true");
    expect(jour).toHaveAttribute("data-periode", "true");
    expect(jour.querySelector("[aria-hidden='true']")).toHaveTextContent("•");
    expect(getByRole("button", { name: "mardi 20 octobre 2026" })).toHaveAttribute(
      "aria-current",
      "date",
    );
  });

  it("choisit un jour au clic et change de mois avec les boutons nommés", async () => {
    const onSelect = vi.fn();
    const onMoisChange = vi.fn();
    const { getByRole } = renderWithProviders(
      <CalendrierMois mois="2026-10" onMoisChange={onMoisChange} onSelect={onSelect} />,
    );
    await userEvent.click(getByRole("button", { name: "vendredi 9 octobre 2026" }));
    expect(onSelect).toHaveBeenCalledWith("2026-10-09");
    await userEvent.click(getByRole("button", { name: "Mois suivant" }));
    expect(onMoisChange).toHaveBeenLastCalledWith("2026-11");
    await userEvent.click(getByRole("button", { name: "Mois précédent" }));
    expect(onMoisChange).toHaveBeenLastCalledWith("2026-09");
  });
});
