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
    await userEvent.click(caseComparer);
    expect(onSelectedChange).toHaveBeenCalledWith(true);
  });
});
