import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../../test-utils.tsx";
import { TableauDonnees } from "./TableauDonnees.tsx";

describe("TableauDonnees", () => {
  it("met la première colonne en en-tête de ligne, formate les nombres, remplace l'absent par « — »", () => {
    renderScreen(
      <TableauDonnees
        legende="Tableau fictif"
        colonnes={[
          { cle: "nom", libelle: "Nom" },
          { cle: "valeur", libelle: "Valeur", numerique: true },
          { cle: "note", libelle: "Note" },
        ]}
        lignes={[{ nom: "Ligne A", valeur: 12345 }]}
      />,
    );
    const tableau = screen.getByRole("table", { name: "Tableau fictif" });
    expect(within(tableau).getByRole("rowheader", { name: "Ligne A" })).toBeInTheDocument();
    expect(within(tableau).getByText(/12\s345/)).toBeInTheDocument();
    expect(within(tableau).getByText("—")).toBeInTheDocument();
  });

  it("supporte un tableau sans colonne", () => {
    renderScreen(<TableauDonnees legende="Tableau vide" colonnes={[]} lignes={[{}]} />);
    expect(screen.getByRole("table", { name: "Tableau vide" })).toBeInTheDocument();
  });
});
