import { fireEvent, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { ComparateurScreen } from "./ComparateurScreen.tsx";
import { amendementsCamille, compareExemple, votesCamille, votesDominique } from "./fixtures.ts";

const pathname = "/deputes/comparer";
const routes = {
  "/deputes/compare": compareExemple,
  "/deputes/camille-exemple/votes": votesCamille,
  "/deputes/dominique-test/votes": votesDominique,
  "/deputes/camille-exemple/amendements": amendementsCamille,
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
    expect(within(stats).getByRole("row", { name: /Présence 60\s%\s40\s%/ })).toBeInTheDocument();
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

  it("compare les amendements et charge ceux d'un élu à la demande, dix par dix", async () => {
    const { findByRole, getByRole, findAllByRole } = renderScreen(
      <ComparateurScreen chambre="assemblee" params={params} />,
      { pathname, routes },
    );
    const section = await findByRole("region", { name: "Amendements" });
    // 2 déposés, 1 adopté : 50 % d'adoption (fixtures).
    expect(section).toHaveTextContent("2 déposés");
    expect(section).toHaveTextContent("1 adopté");
    expect(section).toHaveTextContent("50 % d'adoption");
    expect(section).toHaveTextContent("Calculée par CLAIR");

    const bouton = getByRole("button", {
      name: "Voir les derniers amendements de Camille Exemple",
    });
    expect(bouton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(bouton);
    const liste = await findByRole("list", { name: "Amendements de Camille Exemple" });
    expect(await within(liste).findAllByRole("heading", { level: 4 })).toHaveLength(10);
    expect(
      getByRole("button", { name: "Masquer les amendements de Camille Exemple" }),
    ).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(within(liste).getByRole("button", { name: "Voir plus" }));
    await findAllByRole("heading", { level: 4, name: /12/ });
    expect(within(liste).getAllByRole("heading", { level: 4 })).toHaveLength(12);
    expect(within(liste).queryByRole("button", { name: "Voir plus" })).toBeNull();
  });

  it("signale une erreur récupérable", async () => {
    const { findByRole } = renderScreen(<ComparateurScreen chambre="senat" params={params} />, {
      pathname: "/senateurs/comparer",
      routes: {},
    });
    expect(await findByRole("alert")).toHaveTextContent("Le chargement a échoué");
  });
});
