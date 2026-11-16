import type { CommissionAncienMembre, CommissionMembre } from "@clair/data";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { commissionDetailExemple } from "./fixtures.ts";
import { MembresCommission, rangQualite } from "./MembresCommission.tsx";

const [membre] = commissionDetailExemple.membres;
const [ancien] = commissionDetailExemple.anciensMembres ?? [];
if (!membre || !ancien) throw new Error("fixtures incomplètes");

describe("MembresCommission : états", () => {
  it("range les qualités", () => {
    expect(rangQualite("Président")).toBe(0);
    expect(rangQualite("Vice-présidente")).toBe(1);
    expect(rangQualite("Vice président")).toBe(1);
    expect(rangQualite("Secrétaire")).toBe(2);
    expect(rangQualite("Rapporteur général")).toBe(3);
    expect(rangQualite("Membre")).toBe(10);
    expect(rangQualite(null)).toBe(99);
  });

  it("aucun membre ni ancien membre", () => {
    const { getByText } = renderScreen(<MembresCommission membres={[]} anciens={[]} />);
    expect(getByText("Aucun membre enregistré pour cet organe")).toBeInTheDocument();
  });

  it("seulement d'anciens membres, dont un sans date de fin ; repli et dépli", () => {
    // Ancien membre fictif, sans date de fin ni qualité.
    const sansFin: CommissionAncienMembre = {
      ...ancien,
      qualite: null,
      dateFin: null,
      parlementaire: { ...ancien.parlementaire, id: "parl-exemple-4", chambre: "senat" },
    };
    const { getByText, getByRole, queryByRole } = renderScreen(
      <MembresCommission membres={[]} anciens={[ancien, sansFin]} />,
    );
    expect(getByText("Aucun membre actuel enregistré.")).toBeInTheDocument();
    const bouton = getByRole("button", { name: "Afficher les anciens membres (2)" });
    expect(queryByRole("heading", { name: /Alex Ancien/ })).toBeNull();
    fireEvent.click(bouton);
    expect(bouton).toHaveTextContent("Masquer les anciens membres (2)");
    expect(getByText(/ au /)).toBeInTheDocument();
  });

  it("membre au groupe connu, sans ancien membre", () => {
    // Membre fictif sans qualité.
    const sansQualite: CommissionMembre = { ...membre, qualite: null };
    const { queryByRole, getByText } = renderScreen(
      <MembresCommission membres={[sansQualite]} anciens={[]} />,
    );
    expect(getByText("GRP")).toBeInTheDocument();
    expect(queryByRole("button", { name: /anciens membres/ })).toBeNull();
  });
});
