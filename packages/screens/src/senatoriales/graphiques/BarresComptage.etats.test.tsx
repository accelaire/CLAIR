import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderScreen } from "../../test-utils.tsx";
import type { Comptage } from "../lib/graphiques.ts";
import { BarresComptage } from "./BarresComptage.tsx";

// Décompte fictif.
const DONNEES: Comptage[] = [
  { label: "Commission fictive A", valeur: 3 },
  { label: "Commission fictive B", valeur: 1 },
];

describe("BarresComptage", () => {
  it("annonce l'absence de données", () => {
    renderScreen(<BarresComptage donnees={[]} />);
    expect(screen.getByText("Aucune donnée disponible.")).toBeInTheDocument();
  });

  it("affiche des barres non cliquables sans sélection, avec le tableau des données", () => {
    renderScreen(<BarresComptage donnees={DONNEES} legende="Légende fictive" />);
    expect(screen.queryByRole("button", { name: /Surligner/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Commission fictive A").length).toBeGreaterThan(0);
    expect(screen.getByRole("table", { name: "Légende fictive" })).toBeInTheDocument();
    expect(screen.getAllByText("75 %").length).toBeGreaterThan(0);
  });

  it("calcule les parts sur le total fourni", () => {
    renderScreen(<BarresComptage donnees={DONNEES} total={10} />);
    expect(screen.getAllByText("30 %").length).toBeGreaterThan(0);
    expect(screen.getByRole("table", { name: "Sortants par catégorie" })).toBeInTheDocument();
  });

  it("surligne les sortants d'une barre, ou aucun si la barre n'est pas indexée", () => {
    const onSelection = vi.fn();
    renderScreen(
      <BarresComptage
        donnees={DONNEES}
        onSelection={onSelection}
        sortantsParLabel={{ "Commission fictive A": ["m1", "m2", "m3"] }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Surligner les sortants : Commission fictive A, 3 · 75 %",
      }),
    );
    expect(onSelection).toHaveBeenLastCalledWith(["m1", "m2", "m3"], "Commission fictive A");
    fireEvent.click(screen.getByRole("button", { name: /Commission fictive B/ }));
    expect(onSelection).toHaveBeenLastCalledWith([], "Commission fictive B");
  });

  it("montre l'infobulle d'une barre au survol", () => {
    renderScreen(<BarresComptage donnees={DONNEES} />);
    fireEvent.mouseEnter(screen.getAllByText("Commission fictive B")[0] as HTMLElement, {
      clientX: 5,
      clientY: 5,
    });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Commission fictive B");
    expect(screen.getByRole("tooltip")).toHaveTextContent("25 %");
  });
});
