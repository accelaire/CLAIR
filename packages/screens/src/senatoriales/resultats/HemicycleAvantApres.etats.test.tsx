import { within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../../test-utils.tsx";
import { HemicycleAvantApres } from "./HemicycleAvantApres.tsx";

/* Répartitions FICTIVES. */

describe("HemicycleAvantApres", () => {
  it("résultats complets : colonne des écarts (hausse, baisse, égalité) et sièges hors de l'axe", () => {
    const { getByRole, queryByText, getByText } = renderScreen(
      <HemicycleAvantApres
        avant={{ gauche: 100, centre: 60, droite: 170, divers: 18 }}
        apres={{ gauche: 99, centre: 60, droite: 171, divers: 14, regionaliste: 4 }}
        notes={[]}
        complet
      />,
    );
    expect(getByText("Après le 27 septembre")).toBeInTheDocument();
    const tableau = getByRole("table", {
      name: "Sièges par famille politique, avant et après le scrutin",
    });
    expect(within(tableau).getByRole("columnheader", { name: "Écart" })).toBeInTheDocument();
    expect(within(tableau).getByRole("row", { name: /Gauche 100 99 −1/ })).toBeInTheDocument();
    expect(within(tableau).getByRole("row", { name: /^Droite 170 171 \+1/ })).toBeInTheDocument();
    expect(within(tableau).getByRole("row", { name: /Centre 60 60 =/ })).toBeInTheDocument();
    expect(within(tableau).getByRole("row", { name: /Régionaliste 0 4 \+4/ })).toBeInTheDocument();
    expect(within(tableau).queryByText("Siège non attribué")).toBeNull();
    expect(getByText("18 divers")).toBeInTheDocument();
    expect(getByText("4 régionaliste")).toBeInTheDocument();
    expect(queryByText("Aucun siège hors de l'axe.")).toBeNull();
  });

  it("avant toute attribution : les 178 sièges en pointillés, aucun siège hors de l'axe", () => {
    const { getByText, getAllByText, getByRole } = renderScreen(
      <HemicycleAvantApres
        avant={{ gauche: 100, centre: 70, droite: 178 }}
        apres={{ gauche: 50, centre: 40, droite: 80, non_attribue: 178 }}
        notes={["Note fictive."]}
        complet={false}
      />,
    );
    expect(getByText("les 178 sièges remis en jeu, en pointillés")).toBeInTheDocument();
    expect(getAllByText("Aucun siège hors de l'axe.")).toHaveLength(2);
    expect(getByRole("columnheader", { name: "À ce stade" })).toBeInTheDocument();
    expect(getByRole("row", { name: /Siège non attribué 0 178/ })).toBeInTheDocument();
    expect(getByText("Note fictive.")).toBeInTheDocument();
  });

  it("un seul siège pas encore attribué : au singulier", () => {
    const { getByText } = renderScreen(
      <HemicycleAvantApres
        avant={{ gauche: 100, centre: 70, droite: 178 }}
        apres={{ gauche: 100, centre: 70, droite: 177, non_attribue: 1 }}
        notes={[]}
        complet={false}
      />,
    );
    expect(getByText("À ce stade de la soirée")).toBeInTheDocument();
    expect(getByText("1 siège pas encore attribué")).toBeInTheDocument();
  });

  it("répartition sans clé « non attribué » ni familles de l'arc", () => {
    const { getByText, getAllByRole } = renderScreen(
      <HemicycleAvantApres avant={{}} apres={{ extreme_droite: 2 }} notes={[]} complet={false} />,
    );
    expect(getByText(/0 siège pas encore attribué/)).toBeInTheDocument();
    expect(getAllByRole("img")).toHaveLength(2);
  });
});
