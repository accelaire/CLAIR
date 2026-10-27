import { fireEvent, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { ComparateurScreen } from "./ComparateurScreen.tsx";
import { compareExemple, votesCamille, votesDominique } from "./fixtures.ts";

const pathname = "/deputes/comparer";
const routes = {
  "/deputes/compare": compareExemple,
  "/deputes/camille-exemple/votes": votesCamille,
  "/deputes/dominique-test/votes": votesDominique,
};
const params = { slugs: "camille-exemple,dominique-test" };

describe("ComparateurScreen", () => {
  it("demande au moins deux élus", () => {
    const { getByText, getByRole } = renderScreen(
      <ComparateurScreen chambre="assemblee" params={{ slugs: "camille-exemple" }} />,
      { pathname, routes },
    );
    expect(getByText("Sélection insuffisante")).toBeInTheDocument();
    expect(getByRole("link", { name: /Choisir des députés/ })).toHaveAttribute(
      "href",
      "/deputes?compare=camille-exemple",
    );
  });

  it("annonce le chargement", () => {
    const { getByRole } = renderScreen(<ComparateurScreen chambre="assemblee" params={params} />, {
      pathname,
      routes: { ...routes, "/deputes/compare": () => new Promise(() => {}) },
    });
    expect(getByRole("status")).toHaveTextContent("Chargement de la comparaison");
  });

  it("compare les statistiques dans l'ordre de l'URL et les votes communs", async () => {
    const { findByRole, getAllByRole } = renderScreen(
      <ComparateurScreen chambre="assemblee" params={params} />,
      { pathname, routes },
    );
    const stats = await findByRole("table", { name: "Statistiques comparées" });
    const entetes = within(stats)
      .getAllByRole("columnheader")
      .map((th) => th.textContent);
    expect(entetes).toEqual(["Indicateur", "Camille Exemple", "Dominique Test"]);
    expect(within(stats).getByRole("row", { name: /Présence 60 % 40 %/ })).toBeInTheDocument();
    const votes = await findByRole("table", { name: "Positions de vote par scrutin" });
    // Deux scrutins communs (le troisième n'a été voté que par une élue).
    expect(within(votes).getAllByRole("row")).toHaveLength(3);
    expect(getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(0);
  });

  it("filtre les scrutins divergents et retire un élu par l'URL", async () => {
    const { findByRole, getByLabelText, visited } = renderScreen(
      <ComparateurScreen chambre="assemblee" params={params} />,
      { pathname, routes },
    );
    fireEvent.click(await findByRole("checkbox", { name: /Comparer Camille Exemple/ }));
    fireEvent.click(getByLabelText("Uniquement les scrutins où les positions diffèrent"));
    expect(visited).toEqual([
      "/deputes?compare=dominique-test",
      "/deputes/comparer?slugs=camille-exemple%2Cdominique-test&divergents=1",
    ]);
  });

  it("signale une erreur récupérable", async () => {
    const { findByRole } = renderScreen(<ComparateurScreen chambre="senat" params={params} />, {
      pathname: "/senateurs/comparer",
      routes: {},
    });
    expect(await findByRole("alert")).toHaveTextContent("Le chargement a échoué");
  });
});
