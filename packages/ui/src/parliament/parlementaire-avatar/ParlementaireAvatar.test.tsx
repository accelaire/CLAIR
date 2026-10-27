import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { initiales, ParlementaireAvatar } from "./ParlementaireAvatar.tsx";

describe("ParlementaireAvatar", () => {
  it("donne le nom comme alternative à la photo", () => {
    const { getByRole } = renderWithProviders(
      <ParlementaireAvatar nom="Camille Exemple" photoUrl="/camille.jpg" />,
    );
    expect(getByRole("img", { name: "Camille Exemple" })).toBeInTheDocument();
  });

  it("affiche les initiales sans photo", () => {
    const { getByRole, getByText } = renderWithProviders(
      <ParlementaireAvatar nom="Camille Exemple" />,
    );
    expect(getByRole("img", { name: "Camille Exemple" })).toBeInTheDocument();
    expect(getByText("CE")).toBeInTheDocument();
  });

  it("se masque quand il est décoratif", () => {
    const { queryByRole } = renderWithProviders(
      <ParlementaireAvatar nom="Camille Exemple" decorative />,
    );
    expect(queryByRole("img")).toBeNull();
  });

  it("calcule les initiales du premier et du dernier mot", () => {
    expect(initiales("Jean-Camille de l'Exemple")).toBe("JL");
    expect(initiales("  Dominique   Modèle ")).toBe("DM");
    expect(initiales("Exemple")).toBe("E");
  });
});
