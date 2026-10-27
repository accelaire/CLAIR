import { ApiError } from "@clair/api-client";
import { describe, expect, it } from "vitest";
import { pageScrutins, scrutinsExemples } from "../scrutins-liste/fixtures.ts";
import { renderScreen } from "../test-utils.tsx";
import { VotesArchivesScreen } from "./VotesArchivesScreen.tsx";

describe("VotesArchivesScreen", () => {
  it("liste les années des archives", async () => {
    const { findByRole, getByRole } = renderScreen(<VotesArchivesScreen periode={null} />, {
      routes: { "/scrutins/annees": { data: [{ year: 2025, count: 1234 }] } },
      pathname: "/votes",
    });
    expect(await findByRole("link", { name: "2025" })).toHaveAttribute("href", "/votes/2025");
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("Archives des votes");
  });

  it("annonce le chargement d'une année", () => {
    const { getByRole } = renderScreen(
      <VotesArchivesScreen periode={{ annee: 2025, mois: null }} />,
      { routes: { "/scrutins": () => new Promise(() => undefined) }, pathname: "/votes/2025" },
    );
    expect(getByRole("status")).toHaveTextContent("Chargement des scrutins");
  });

  it("montre les scrutins d'une année, ses mois et la pagination", async () => {
    const requetes: unknown[] = [];
    const { findByRole, getByRole } = renderScreen(
      <VotesArchivesScreen periode={{ annee: 2025, mois: null }} />,
      {
        routes: {
          "/scrutins": (query: unknown) => {
            requetes.push(query);
            return pageScrutins(scrutinsExemples, { totalPages: 2, total: 60 });
          },
        },
        pathname: "/votes/2025",
      },
    );
    expect(await findByRole("link", { name: /L'amendement d'exemple/ })).toHaveAttribute(
      "href",
      "/scrutins/12?chambre=senat&session=2025",
    );
    expect(getByRole("link", { name: "Mars" })).toHaveAttribute("href", "/votes/2025/03");
    expect(getByRole("link", { name: "Page 2" })).toHaveAttribute("href", "/votes/2025?page=2");
    expect(requetes[0]).toMatchObject({ dateFrom: "2025-01-01", dateTo: "2025-12-31" });
  });

  it("propose le mois précédent et le suivant", async () => {
    const { findByRole, getByRole } = renderScreen(
      <VotesArchivesScreen periode={{ annee: 2025, mois: 1 }} />,
      { routes: { "/scrutins": pageScrutins(scrutinsExemples) }, pathname: "/votes/2025/01" },
    );
    expect(await findByRole("heading", { level: 1 })).toHaveTextContent("Votes Janvier 2025");
    expect(getByRole("link", { name: /Décembre 2024/ })).toHaveAttribute("href", "/votes/2024/12");
    expect(getByRole("link", { name: /Février 2025/ })).toHaveAttribute("href", "/votes/2025/02");
  });

  it("signale une période vide", async () => {
    const { findByText } = renderScreen(
      <VotesArchivesScreen periode={{ annee: 2007, mois: null }} />,
      { routes: { "/scrutins": pageScrutins([]) }, pathname: "/votes/2007" },
    );
    expect(await findByText("Aucun scrutin sur cette période")).toBeInTheDocument();
  });

  it("affiche une erreur récupérable", async () => {
    const { findByRole } = renderScreen(
      <VotesArchivesScreen periode={{ annee: 2025, mois: null }} />,
      {
        routes: { "/scrutins": () => Promise.reject(new ApiError(500, "/scrutins")) },
        pathname: "/votes/2025",
      },
    );
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });
});
