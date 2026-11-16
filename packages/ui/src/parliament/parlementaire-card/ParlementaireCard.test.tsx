import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { ancienDeputeExemple, deputeExemple, senateurExemple } from "../fixtures.ts";
import { ParlementaireCard } from "./ParlementaireCard.tsx";

describe("ParlementaireCard", () => {
  it("mène à la fiche par un seul lien, le nom", () => {
    const { getAllByRole, getByRole } = renderWithProviders(
      <ParlementaireCard parlementaire={deputeExemple} chambre="assemblee" href="/fiche" />,
    );
    expect(getAllByRole("link")).toHaveLength(1);
    expect(getByRole("link", { name: "Camille Exemple" })).toHaveAttribute("href", "/fiche");
    expect(getByRole("heading", { name: "Camille Exemple" })).toBeInTheDocument();
  });

  it("affiche le groupe et la circonscription d'un député", () => {
    const { getByText } = renderWithProviders(
      <ParlementaireCard parlementaire={deputeExemple} chambre="assemblee" href="/fiche" />,
    );
    expect(getByText("ECO")).toBeInTheDocument();
    expect(getByText("Exemple-sur-Mer (99), 1re circonscription")).toBeInTheDocument();
  });

  it("donne le département d'un sénateur, sans numéro de circonscription", () => {
    const { getByText } = renderWithProviders(
      <ParlementaireCard parlementaire={senateurExemple} chambre="senat" href="/fiche" />,
    );
    expect(getByText("Département-Modèle (98)")).toBeInTheDocument();
  });

  it("signale un ancien élu", () => {
    const { getByText } = renderWithProviders(
      <ParlementaireCard parlementaire={ancienDeputeExemple} chambre="assemblee" href="/fiche" />,
    );
    expect(getByText("Ancien député")).toBeInTheDocument();
  });

  it("écrit la fonction dans un organe à côté du nom, dans le lien", () => {
    const { getByRole } = renderWithProviders(
      <ParlementaireCard
        parlementaire={deputeExemple}
        chambre="assemblee"
        href="/fiche"
        fonction="Présidente"
        compact
      />,
    );
    expect(getByRole("heading", { name: "Camille Exemple Présidente" })).toBeInTheDocument();
    expect(getByRole("link", { name: "Camille Exemple Présidente" })).toHaveAttribute(
      "href",
      "/fiche",
    );
  });

  it("sélectionne pour le comparateur par une case distincte du lien", async () => {
    const onSelectedChange = vi.fn();
    const { getByRole } = renderWithProviders(
      <ParlementaireCard
        parlementaire={deputeExemple}
        chambre="assemblee"
        href="/fiche"
        selectable
        onSelectedChange={onSelectedChange}
      />,
    );
    const caseComparer = getByRole("checkbox", { name: "Comparer Camille Exemple" });
    // Sous le nom, dans la carte : le nom garde toute la largeur.
    const titre = getByRole("heading", { name: /Camille Exemple/ });
    expect(
      titre.compareDocumentPosition(caseComparer) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(caseComparer.closest("article")).toBe(titre.closest("article"));
    expect(getByRole("link", { name: /Camille Exemple/ })).not.toContainElement(caseComparer);
    await userEvent.click(caseComparer);
    expect(onSelectedChange).toHaveBeenCalledWith(true);
  });
});
