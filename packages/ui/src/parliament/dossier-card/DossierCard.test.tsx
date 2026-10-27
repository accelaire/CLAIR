import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { dossierEnCours, dossierPromulgue } from "../fixtures.ts";
import { DossierCard, formatDossierTitre } from "./DossierCard.tsx";

describe("DossierCard", () => {
  it("mène au dossier par son titre, complété de la procédure", () => {
    const { getAllByRole, getByRole } = renderWithProviders(
      <DossierCard dossier={dossierEnCours} href="/dossier" />,
    );
    expect(getAllByRole("link")).toHaveLength(1);
    expect(
      getByRole("link", {
        name: "Proposition de loi relative à la protection des exemples dans l'espace public",
      }),
    ).toHaveAttribute("href", "/dossier");
  });

  it("donne l'état en texte, la date du dernier vote et les compteurs", () => {
    const { getByText } = renderWithProviders(
      <DossierCard dossier={dossierEnCours} href="/dossier" />,
    );
    expect(getByText("En cours")).toHaveAttribute("data-tone", "info");
    expect(getByText("20 janvier 2026")).toBeInTheDocument();
    expect(getByText("4 scrutins")).toBeInTheDocument();
    expect(getByText("128 amendements")).toBeInTheDocument();
  });

  it("présente une loi promulguée avec ses liens officiels quand la carte est statique", () => {
    const { getByRole, getByText, queryByRole } = renderWithProviders(
      <DossierCard dossier={dossierPromulgue} />,
    );
    expect(queryByRole("link", { name: dossierPromulgue.titre })).toBeNull();
    expect(getByText("Promulgué")).toBeInTheDocument();
    expect(getByText(/Loi n° 2026-0000/)).toBeInTheDocument();
    expect(
      getByRole("link", { name: "Texte de la loi sur Légifrance (nouvelle fenêtre)" }),
    ).toHaveAttribute("href", "https://www.legifrance.gouv.fr");
  });

  it("préfixe un titre en minuscule par la procédure", () => {
    expect(formatDossierTitre("visant à tester", "Proposition de loi")).toBe(
      "Proposition de loi visant à tester",
    );
    expect(formatDossierTitre("Projet de loi d'exemple", "Projet de loi")).toBe(
      "Projet de loi d'exemple",
    );
  });

  it("survit à une date invalide venue des données", () => {
    const { getAllByText } = renderWithProviders(
      <DossierCard
        dossier={{ ...dossierPromulgue, dateDepot: "invalide", loiDateJO: "invalide" }}
      />,
    );
    expect(getAllByText("date inconnue").length).toBeGreaterThan(0);
  });
});
