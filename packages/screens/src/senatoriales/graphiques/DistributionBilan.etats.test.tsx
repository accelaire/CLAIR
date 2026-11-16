import type { Sortant } from "@clair/data";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderScreen } from "../../test-utils.tsx";
import { sortantsExemple } from "../fixtures.ts";
import { DistributionBilan } from "./DistributionBilan.tsx";

const base = sortantsExemple[0] as Sortant;
// Vingt sortants fictifs, de 5 % à 100 % de loyauté.
const vingt: Sortant[] = Array.from({ length: 20 }, (_, i) => ({
  ...base,
  mandatId: `mandat-${i}`,
  personne: { ...base.personne, slug: `sortant-fictif-${i}`, nom: `Fictif${i}` },
  bilan: { ...base.bilan, loyaute: (i + 1) * 5 },
}));

describe("DistributionBilan", () => {
  it("annonce l'absence de mesure", () => {
    renderScreen(
      <DistributionBilan sortants={[sortantsExemple[1] as Sortant]} metrique="loyaute" />,
    );
    expect(screen.getByText("Aucune donnée disponible.")).toBeInTheDocument();
  });

  it("nomme les cinq taux les plus bas au-delà de quinze mesures", () => {
    renderScreen(<DistributionBilan sortants={vingt} metrique="loyaute" />);
    expect(screen.getByRole("heading", { name: "Les cinq taux les plus bas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Fictif0/ })).toHaveAttribute(
      "href",
      "/senateurs/sortant-fictif-0",
    );
    expect(
      screen.getByText(/20 sortants mesurés, médiane à 53 % de loyauté au groupe/),
    ).toBeInTheDocument();
  });

  it("surligne les sortants d'une tranche", () => {
    const onSelection = vi.fn();
    renderScreen(
      <DistributionBilan sortants={vingt} metrique="loyaute" onSelection={onSelection} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /loyauté au groupe 99 % et plus, 1/ }));
    expect(onSelection).toHaveBeenCalledWith(["mandat-19"], "99 % et plus");
  });
});
