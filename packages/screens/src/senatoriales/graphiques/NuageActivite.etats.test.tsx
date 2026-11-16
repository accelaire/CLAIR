import type { Sortant } from "@clair/data";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderScreen } from "../../test-utils.tsx";
import { sortantsExemple } from "../fixtures.ts";
import { NuageActivite } from "./NuageActivite.tsx";

const base = sortantsExemple[0] as Sortant;
// Sortant fictif peu actif : graduations sous 10, au dixième.
const peuActif: Sortant = {
  ...base,
  mandatId: "mandat-calme",
  bilan: { ...base.bilan, interventions: 2, amendements: 3 },
  mandat: { ...base.mandat, dureeMois: 1 },
};

describe("NuageActivite", () => {
  it("annonce l'absence de données", () => {
    const sansStat: Sortant = {
      ...base,
      bilan: { ...base.bilan, interventions: null, amendements: null },
    };
    renderScreen(<NuageActivite sortants={[sansStat]} />);
    expect(screen.getByText("Aucune donnée disponible.")).toBeInTheDocument();
  });

  it("dessine un point par sortant et le tableau des données", () => {
    renderScreen(<NuageActivite sortants={sortantsExemple} />);
    expect(
      screen.getByRole("img", { name: /Nuage de points des 3 sénateurs sortants/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Activité mensuelle des sortants" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Camille Fictif" })).toBeInTheDocument();
    // 300 amendements / 72 mois.
    expect(screen.getAllByText("4,2").length).toBeGreaterThan(0);
  });

  it("gradue au dixième pour une activité faible", () => {
    renderScreen(<NuageActivite sortants={[peuActif]} />);
    expect(screen.getByText("0.8")).toBeInTheDocument();
    expect(screen.getByText("2.3")).toBeInTheDocument();
  });

  it("surligne un sortant au clic et montre son infobulle au survol", () => {
    const onSelection = vi.fn();
    const { container } = renderScreen(
      <NuageActivite sortants={sortantsExemple} onSelection={onSelection} />,
    );
    const points = container.querySelectorAll("circle");
    expect(points).toHaveLength(3);
    const premier = points[0] as SVGCircleElement;
    fireEvent.click(premier);
    expect(onSelection).toHaveBeenCalledWith(["mandat-1"], "Hervé Exemple");
    fireEvent.mouseEnter(premier, { clientX: 1, clientY: 1 });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Interventions / mois");
  });
});
