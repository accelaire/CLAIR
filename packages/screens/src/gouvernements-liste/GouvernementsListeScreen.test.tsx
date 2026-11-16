import { ApiError } from "@clair/api-client";
import { within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { gouvernementsFixture } from "./fixtures.ts";
import { GouvernementsListeScreen, parPresidence } from "./GouvernementsListeScreen.tsx";

// Le 1er novembre 2026 à midi, heure de Paris.
const MAINTENANT = Date.parse("2026-11-01T11:00:00Z");

describe("GouvernementsListeScreen", () => {
  it("regroupe les gouvernements par présidence, dans l'ordre reçu", () => {
    expect(parPresidence(gouvernementsFixture.data).map((g) => g.titre)).toEqual([
      "Présidence d’Ariane Exemple",
      "Présidence de Bruno Modèle",
    ]);
  });

  it("affiche les cartes, le gouvernement en fonction et la source", () => {
    const { getByRole, getAllByRole, getByText } = renderScreen(
      <GouvernementsListeScreen initialData={gouvernementsFixture} maintenant={MAINTENANT} />,
      { routes: { "/gouvernements": gouvernementsFixture }, pathname: "/gouvernements" },
    );
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("Gouvernements");
    expect(getByText(/3 gouvernements depuis 2007/)).toBeInTheDocument();
    expect(getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Présidence d’Ariane Exemple",
      "Présidence de Bruno Modèle",
    ]);
    const carte = getByRole("link", { name: "Gouvernement Fictif II" }).closest("li");
    expect(carte).not.toBeNull();
    if (!carte) return;
    expect(within(carte).getByText("En fonction")).toBeInTheDocument();
    expect(within(carte).getByRole("link", { name: "Camille Fictif" })).toHaveAttribute(
      "href",
      "/deputes/camille-fictif",
    );
    expect(carte).toHaveTextContent("34 membres, dont 17 femmes (50 %)");
    expect(carte).toHaveTextContent("2 recours au 49.3, 3 motions de censure");
    expect(carte).toHaveTextContent(/Durée : \d+ an/);
    expect(getByRole("link", { name: /open data de l’Assemblée nationale/ })).toHaveAttribute(
      "href",
      "https://example.org/source",
    );
  });

  it("n'affiche pas de bilan avant juin 2017, et un membre sans fiche sans lien", () => {
    const { getByRole } = renderScreen(
      <GouvernementsListeScreen initialData={gouvernementsFixture} maintenant={MAINTENANT} />,
      { routes: { "/gouvernements": gouvernementsFixture } },
    );
    const carte = getByRole("link", { name: "Gouvernement Imaginaire" }).closest("li");
    if (!carte) throw new Error("carte absente");
    expect(carte).not.toHaveTextContent("49.3");
    expect(within(carte).getByText(/Première ministre/)).toBeInTheDocument();
    expect(within(carte).queryByRole("link", { name: "Dominique Imaginaire" })).toBeNull();
  });

  it("propose de réessayer en cas d'erreur", async () => {
    const { findByRole } = renderScreen(<GouvernementsListeScreen maintenant={MAINTENANT} />, {
      routes: {
        "/gouvernements": () => Promise.reject(new ApiError(500, "/gouvernements")),
      },
    });
    expect(await findByRole("button", { name: /Réessayer/ })).toBeInTheDocument();
  });
});
