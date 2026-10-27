import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { AProposScreen } from "./AProposScreen.tsx";

describe("AProposScreen", () => {
  it("présente la mission, l'offre, les valeurs et les liens utiles", () => {
    const { getByRole, getAllByRole } = renderScreen(<AProposScreen />);
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("Rendre la politique lisible");
    expect(getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Notre mission",
      "Ce que nous proposons",
      "Nos valeurs",
      "Projet open source",
      "Nous contacter",
    ]);
    expect(getByRole("link", { name: "En savoir plus sur la méthodologie" })).toHaveAttribute(
      "href",
      "/methodologie",
    );
    expect(getByRole("link", { name: /Voir sur GitHub/ })).toHaveAttribute("target", "_blank");
  });
});
