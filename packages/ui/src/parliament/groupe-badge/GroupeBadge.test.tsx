import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { couleurGroupe, GroupeBadge } from "./GroupeBadge.tsx";

describe("GroupeBadge", () => {
  it("affiche le sigle et donne le nom complet aux lecteurs d'écran", () => {
    const { getByText, getByTitle } = renderWithProviders(
      <GroupeBadge sigle="ECO" nom="Écologiste et Social" />,
    );
    expect(getByText("ECO")).toBeInTheDocument();
    expect(getByTitle("Écologiste et Social")).toHaveTextContent("ECO, Écologiste et Social");
  });

  it("masque la pastille de couleur aux lecteurs d'écran", () => {
    const { getByText } = renderWithProviders(<GroupeBadge sigle="RN" couleur="#0D378A" />);
    const badge = getByText("RN");
    // La pastille porte la couleur, n'a aucun texte et est masquée : le sigle seul est lu.
    const pastille = badge.querySelector("[aria-hidden='true']");
    expect(pastille).not.toBeNull();
    expect(pastille).toHaveTextContent("");
    expect(badge).toHaveAttribute("style", expect.stringContaining("--groupe-couleur: #0D378A"));
    expect(badge.textContent).toBe("RN");
  });
});

describe("couleurGroupe", () => {
  it("préfère la couleur de l'API", () => {
    expect(couleurGroupe("LR", "#0066CC")).toBe("#0066CC");
    expect(couleurGroupe("LR", "204,36,67")).toBe("rgb(204, 36, 67)");
  });

  it("se replie sur le token du sigle quand la couleur manque ou vaut le noir par défaut", () => {
    expect(couleurGroupe("LFI", null)).toBe("var(--clair-groupe-lfi, var(--clair-groupe-ni))");
    expect(couleurGroupe("CRCE-K", "#000000")).toBe(
      "var(--clair-groupe-crce-k, var(--clair-groupe-ni))",
    );
  });

  it("refuse une valeur qui n'est pas une couleur", () => {
    expect(couleurGroupe("NI", "red; background: url(x)")).toBe(
      "var(--clair-groupe-ni, var(--clair-groupe-ni))",
    );
  });
});
