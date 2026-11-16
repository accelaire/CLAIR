import { ApiError } from "@clair/api-client";
import { describe, expect, it } from "vitest";
import { pageScrutins, scrutinsExemples } from "../scrutins-liste/fixtures.ts";
import { renderScreen } from "../test-utils.tsx";
import { libellePeriode, moisVoisins } from "./params.ts";
import { VotesArchivesScreen } from "./VotesArchivesScreen.tsx";

describe("VotesArchivesScreen, états de l'index", () => {
  it("annonce le chargement des années", () => {
    const { getByRole } = renderScreen(<VotesArchivesScreen periode={null} />, {
      routes: { "/scrutins/annees": () => new Promise(() => undefined) },
      pathname: "/votes",
    });
    expect(getByRole("status")).toHaveTextContent("Chargement des années");
  });

  it("propose de réessayer quand les années ne se chargent pas", async () => {
    const { findByRole } = renderScreen(<VotesArchivesScreen periode={null} />, {
      routes: { "/scrutins/annees": () => Promise.reject(new ApiError(500, "/scrutins/annees")) },
      pathname: "/votes",
    });
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("dit qu'aucune année n'est disponible", async () => {
    const { findByText } = renderScreen(<VotesArchivesScreen periode={null} />, {
      routes: { "/scrutins/annees": { data: [] } },
      pathname: "/votes",
    });
    expect(await findByText("Aucune donnée disponible")).toBeInTheDocument();
  });
});

describe("VotesArchivesScreen, bornes de l'historique", () => {
  it("n'offre pas de mois avant le premier de l'historique", async () => {
    const { findByRole } = renderScreen(
      <VotesArchivesScreen periode={{ annee: 2006, mois: 1 }} />,
      {
        routes: { "/scrutins": pageScrutins(scrutinsExemples) },
        pathname: "/votes/2006/01",
      },
    );
    const nav = await findByRole("navigation", { name: "Navigation entre les mois" });
    expect(nav).not.toHaveTextContent("Décembre 2005");
    expect(nav).toHaveTextContent("Février 2006");
  });

  it("borne les voisins à l'historique et au mois courant", () => {
    expect(moisVoisins(2006, 1, new Date(2026, 2, 1)).precedent).toBeNull();
    expect(moisVoisins(2025, 12, new Date(2026, 2, 1)).suivant).toEqual({ annee: 2026, mois: 1 });
    expect(moisVoisins(2026, 3, new Date(2026, 2, 15)).suivant).toBeNull();
    expect(libellePeriode({ annee: 2025, mois: null })).toBe("2025");
  });
});
