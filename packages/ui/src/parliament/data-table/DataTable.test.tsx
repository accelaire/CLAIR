import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { classementExemple, colonnesClassement } from "../timeline-fixtures.ts";
import { DataTable } from "./DataTable.tsx";

const noms = (rows: HTMLElement[]) =>
  rows.slice(1).map((row) => row.querySelector("th")?.textContent ?? "");

describe("DataTable", () => {
  it("nomme le tableau et sa zone de défilement par la légende, avec des en-têtes de colonne", () => {
    const { getByRole, getAllByRole } = renderWithProviders(
      <DataTable
        caption="Classement des parlementaires"
        columns={colonnesClassement}
        rows={classementExemple}
        getRowKey={(row) => row.id}
      />,
    );
    expect(getByRole("table", { name: "Classement des parlementaires" })).toBeInTheDocument();
    const zone = getByRole("region", { name: "Classement des parlementaires" });
    expect(zone).toHaveAttribute("tabindex", "0");
    for (const entete of getAllByRole("columnheader")) {
      expect(entete).toHaveAttribute("scope", "col");
    }
    expect(getByRole("rowheader", { name: "Camille Exemple" })).toHaveAttribute("scope", "row");
  });

  it("trie au clic sur l'en-tête et expose aria-sort", async () => {
    const { getByRole, getAllByRole, getByText } = renderWithProviders(
      <DataTable
        caption="Classement"
        columns={colonnesClassement}
        rows={classementExemple}
        getRowKey={(row) => row.id}
      />,
    );
    const presence = getByRole("button", { name: "Présence" });
    await userEvent.click(presence);
    expect(getByRole("columnheader", { name: "Présence" })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    expect(noms(getAllByRole("row"))).toEqual([
      "Camille Exemple",
      "Alix Fictif",
      "Dominique Modèle",
      "Élise Témoin",
      "Sacha Démo",
    ]);
    expect(getByText("Tableau trié par Présence, ordre décroissant.")).toBeInTheDocument();

    await userEvent.click(presence);
    expect(getByRole("columnheader", { name: "Présence" })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(noms(getAllByRole("row"))[0]).toBe("Élise Témoin");
    expect(noms(getAllByRole("row")).at(-1)).toBe("Sacha Démo");
  });

  it("laisse le parent trier en mode contrôlé et manuel", async () => {
    const onSortChange = vi.fn();
    const { getByRole, getAllByRole } = renderWithProviders(
      <DataTable
        caption="Classement"
        columns={colonnesClassement}
        rows={classementExemple}
        getRowKey={(row) => row.id}
        sort={{ key: "amendements", direction: "descending" }}
        onSortChange={onSortChange}
        manualSort
      />,
    );
    // Mode manuel : les lignes restent dans l'ordre fourni par le parent, toutes, pas seulement la première.
    const ordreFourni = noms(getAllByRole("row"));
    expect(ordreFourni).toHaveLength(classementExemple.length);
    await userEvent.click(getByRole("button", { name: "Groupe" }));
    expect(noms(getAllByRole("row"))).toEqual(ordreFourni);
    expect(onSortChange).toHaveBeenCalledWith({ key: "groupe", direction: "ascending" });
  });

  it("affiche un état vide", () => {
    const { getByText } = renderWithProviders(
      <DataTable
        caption="Classement"
        columns={colonnesClassement}
        rows={[]}
        getRowKey={(row) => row.id}
      />,
    );
    expect(getByText("Aucune donnée à afficher")).toBeInTheDocument();
  });
});
