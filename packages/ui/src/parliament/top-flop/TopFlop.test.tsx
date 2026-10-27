import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { flopExemple, topExemple } from "../timeline-fixtures.ts";
import { TopFlop } from "./TopFlop.tsx";

const pourcent = (value: number) => `${value} %`;

describe("TopFlop", () => {
  it("rend deux listes titrées, avec rang, nom en lien et valeur en texte", () => {
    const { getByRole } = renderWithProviders(
      <TopFlop criterion="Présence" top={topExemple} flop={flopExemple} formatValue={pourcent} />,
    );
    const haut = getByRole("list", { name: "Les plus élevés — Présence" });
    const bas = getByRole("list", { name: "Les moins élevés — Présence" });
    const premier = haut.querySelector("li");
    expect(premier).toHaveTextContent("Rang 1");
    expect(premier).toHaveTextContent("Présence : 99 %");
    expect(bas.querySelector("li")).toHaveTextContent("Rang 577");
    expect(getByRole("link", { name: "Camille Exemple" })).toHaveAttribute(
      "href",
      "#parlementaire",
    );
  });

  it("indique la nature calculée de la donnée et une valeur manquante", () => {
    const { getByText } = renderWithProviders(
      <TopFlop
        criterion="Présence"
        top={[{ id: "a", name: "Camille Exemple", value: null }]}
        flop={[]}
      />,
    );
    expect(getByText("Calculée par CLAIR")).toBeInTheDocument();
    expect(getByText(/non disponible/)).toBeInTheDocument();
    expect(getByText("Aucun résultat")).toBeInTheDocument();
  });
});
