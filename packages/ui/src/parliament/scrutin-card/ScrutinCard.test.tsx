import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { scrutinAdopte, scrutinRejete } from "../fixtures.ts";
import { ScrutinCard } from "./ScrutinCard.tsx";

describe("ScrutinCard", () => {
  it("mène au scrutin par son titre", () => {
    const { getAllByRole, getByRole } = renderWithProviders(
      <ScrutinCard scrutin={scrutinAdopte} href="/scrutin" />,
    );
    expect(getAllByRole("link")).toHaveLength(1);
    expect(getByRole("link", { name: scrutinAdopte.titre })).toHaveAttribute("href", "/scrutin");
  });

  it("donne le résultat chiffré en texte et le sort en badge", () => {
    const { getByText } = renderWithProviders(
      <ScrutinCard scrutin={scrutinAdopte} href="/scrutin" />,
    );
    expect(getByText("Pour").nextElementSibling).toHaveTextContent("312");
    expect(getByText("Contre").nextElementSibling).toHaveTextContent("205");
    expect(getByText("Abstention").nextElementSibling).toHaveTextContent("41");
    expect(getByText("Adopté")).toHaveAttribute("data-tone", "succes");
    expect(getByText("18 novembre 2025")).toBeInTheDocument();
  });

  it("place le sort près du titre, avec le numéro, et garde le titre entier dans le lien", () => {
    const { getByText, getByRole } = renderWithProviders(
      <ScrutinCard scrutin={scrutinAdopte} href="/scrutin" />,
    );
    const surtitre = getByText(`Scrutin n° ${scrutinAdopte.numero}`).parentElement;
    expect(surtitre).toContainElement(getByText("Adopté"));
    expect(getByRole("heading", { level: 3 })).toHaveTextContent(scrutinAdopte.titre);
  });

  it("annonce un scrutin rejeté et sa chambre", () => {
    const { getByText } = renderWithProviders(
      <ScrutinCard scrutin={scrutinRejete} href="/scrutin" />,
    );
    expect(getByText("Rejeté")).toHaveAttribute("data-tone", "erreur");
    expect(getByText("Sénat")).toBeInTheDocument();
    expect(getByText("Scrutin n° 87")).toBeInTheDocument();
  });

  it("date le scrutin au jour de Paris, quel que soit le fuseau du serveur", () => {
    const { getByText } = renderWithProviders(
      <ScrutinCard
        scrutin={{ ...scrutinRejete, date: "2026-03-12T23:30:00.000Z" }}
        href="/scrutin"
      />,
    );
    expect(getByText("13 mars 2026")).toBeInTheDocument();
  });

  it("signale l'importance comme un classement calculé", () => {
    const { getByText } = renderWithProviders(
      <ScrutinCard scrutin={scrutinAdopte} href="/scrutin" />,
    );
    // Visible, pas seulement lu : un classement automatique ne doit pas passer pour une donnée officielle.
    expect(getByText("Important · calculé par CLAIR")).toBeVisible();
  });

  it("montre trois thématiques au plus et compte les autres", () => {
    const { getByText } = renderWithProviders(
      <ScrutinCard scrutin={scrutinAdopte} href="/scrutin" />,
    );
    const tags = getByText(/Budget, Santé, Travail/);
    expect(tags).toHaveTextContent("Thématiques : Budget, Santé, Travail +2 et 2 autres");
    expect(tags).not.toHaveTextContent("Europe");
  });

  it("n'annonce aucune thématique quand le scrutin n'en a pas", () => {
    const { queryByText } = renderWithProviders(
      <ScrutinCard scrutin={{ ...scrutinRejete, tags: [] }} href="/scrutin" />,
    );
    expect(queryByText(/Thématiques/)).toBeNull();
  });

  it("survit à une date invalide venue des données", () => {
    const { getByText } = renderWithProviders(
      <ScrutinCard scrutin={{ ...scrutinAdopte, date: "" }} href="/scrutin" />,
    );
    expect(getByText("date inconnue")).toBeInTheDocument();
  });
});
