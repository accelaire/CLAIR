import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { StatutBadge } from "./StatutBadge.tsx";
import { parseStatut } from "./statuts.ts";

describe("StatutBadge", () => {
  it("affiche le libellé du statut avec son ton", () => {
    const { getByText } = renderWithProviders(<StatutBadge statut="rejete" />);
    expect(getByText("Rejeté")).toHaveAttribute("data-tone", "erreur");
  });

  it("accepte un libellé plus précis sans changer le ton", () => {
    const { getByText } = renderWithProviders(
      <StatutBadge statut="irrecevable" label="Irrecevable (art. 40)" />,
    );
    expect(getByText("Irrecevable (art. 40)")).toHaveAttribute("data-tone", "neutre");
  });

  it("distingue les états d'un dossier", () => {
    const { getByText } = renderWithProviders(
      <>
        <StatutBadge statut="promulgue" />
        <StatutBadge statut="en_cours" />
      </>,
    );
    expect(getByText("Promulgué")).toHaveAttribute("data-tone", "succes");
    expect(getByText("En cours")).toHaveAttribute("data-tone", "info");
  });
});

describe("parseStatut", () => {
  it.each([
    ["adopte", "adopte"],
    ["Adopté", "adopte"],
    ["adopté", "adopte"],
    ["Adopté modifié", "adopte_modifie"],
    ["rejete", "rejete"],
    ["Non soutenu", "non_soutenu"],
    ["cet_amendement_est_retiré_avant_séance", "retire"],
    ["Retiré après publication", "retire"],
    ["Tombé", "tombe"],
    ["Entonnoir (45)", "tombe"],
    ["Cavalier (45)", "irrecevable"],
    ["Autres irr LOLF", "irrecevable"],
    ["Satisfait ou inopérant (42)", "satisfait"],
    ["En traitement", "en_attente"],
    ["promulgue", "promulgue"],
    ["en_cours", "en_cours"],
  ])("« %s » → %s", (raw, statut) => {
    expect(parseStatut(raw)).toBe(statut);
  });

  it("renvoie null pour une valeur absente ou inconnue", () => {
    expect(parseStatut(null)).toBeNull();
    expect(parseStatut("")).toBeNull();
    expect(parseStatut("Doublon")).toBeNull();
  });
});
