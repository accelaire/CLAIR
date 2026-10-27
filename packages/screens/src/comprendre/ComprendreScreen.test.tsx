import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { ComprendreScreen } from "./ComprendreScreen.tsx";

describe("ComprendreScreen", () => {
  it("liste les sept fiches et renvoie vers le guide", () => {
    const { getByRole, getAllByRole } = renderScreen(<ComprendreScreen />);
    expect(getByRole("heading", { level: 1 })).toHaveTextContent(
      "Comprendre la politique française",
    );
    expect(getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Le Parlement",
      "Le parlementaire",
      "Le scrutin",
      "Le dossier législatif",
      "Les groupes politiques",
      "Le lobbying",
      "Les commissions",
    ]);
    expect(getByRole("link", { name: "Le Parlement" })).toHaveAttribute(
      "href",
      "/comprendre/parlement",
    );
    expect(getByRole("link", { name: "Découvrir le guide pratique" })).toHaveAttribute(
      "href",
      "/guide",
    );
  });
});
