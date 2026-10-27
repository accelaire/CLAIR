import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { FilterBar } from "./FilterBar.tsx";

const filtre = <input aria-label="Filtre d'exemple" />;

describe("FilterBar", () => {
  it("regroupe la recherche et les filtres, sans réinitialisation si rien n'est actif", () => {
    const { getByRole, queryByRole, getAllByRole } = renderWithProviders(
      <FilterBar search={<input aria-label="Rechercher" />} onReset={() => {}}>
        {filtre}
      </FilterBar>,
    );
    expect(getByRole("region", { name: "Filtres" })).toBeInTheDocument();
    expect(getByRole("textbox", { name: "Rechercher" })).toBeInTheDocument();
    expect(getAllByRole("textbox", { name: "Filtre d'exemple" })).toHaveLength(1);
    expect(queryByRole("button", { name: "Réinitialiser" })).toBeNull();
    expect(queryByRole("list", { name: "Filtres actifs" })).toBeNull();
  });

  it("liste les filtres actifs en pastilles retirables et réinitialise", async () => {
    const remove = vi.fn();
    const onReset = vi.fn();
    const { getByRole } = renderWithProviders(
      <FilterBar
        activeFilters={[
          { id: "chambre=senat", label: "Chambre : Sénat", onRemove: () => {} },
          { id: "groupe=SOC", label: "Groupe : SOC", onRemove: remove },
        ]}
        onReset={onReset}
      >
        {filtre}
      </FilterBar>,
    );
    const list = getByRole("list", { name: "Filtres actifs" });
    expect(list.querySelectorAll("li")).toHaveLength(2);
    await userEvent.click(getByRole("button", { name: "Retirer le filtre Groupe : SOC" }));
    expect(remove).toHaveBeenCalled();
    await userEvent.click(getByRole("button", { name: "Réinitialiser" }));
    expect(onReset).toHaveBeenCalled();
  });

  it("annonce le nombre de filtres actifs sur le bouton du tiroir", () => {
    const { getByRole } = renderWithProviders(<FilterBar activeCount={2}>{filtre}</FilterBar>);
    expect(
      getByRole("button", { name: /^Filtres\s*, 2 filtres actifs$/, hidden: true }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("ouvre le tiroir des filtres et le ferme avec Échap", async () => {
    const { getByRole, queryByRole } = renderWithProviders(<FilterBar>{filtre}</FilterBar>);
    const toggle = getByRole("button", { name: "Filtres", hidden: true });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const dialog = getByRole("dialog", { name: "Filtres" });
    expect(dialog).toBeInTheDocument();
    expect(getByRole("button", { name: "Fermer les filtres" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => expect(queryByRole("dialog")).toBeNull());
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
