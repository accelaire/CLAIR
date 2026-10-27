import { fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import {
  actionExemple,
  lobbyisteExemple,
  lobbyisteExemple2,
  pageLobbyistes,
  secteursExemple,
  statsExemple,
} from "./fixtures.ts";
import { LobbyingListeScreen } from "./LobbyingListeScreen.tsx";

const routes = (lobbyistes = [lobbyisteExemple, lobbyisteExemple2], totalPages = 3) => ({
  "/lobbying": pageLobbyistes(lobbyistes, { totalPages }),
  "/lobbying/secteurs": secteursExemple,
  "/lobbying/stats": statsExemple,
  "/lobbying/actions/recent": { data: [actionExemple] },
});

describe("LobbyingListeScreen", () => {
  it("annonce le chargement", () => {
    const { getByRole } = renderScreen(<LobbyingListeScreen />, {
      routes: { "/lobbying": () => new Promise(() => {}) },
      pathname: "/lobbying",
    });
    expect(getByRole("status")).toHaveTextContent("Chargement des représentants");
  });

  it("liste les représentants, les chiffres et les dernières actions", async () => {
    const { findByRole, getByRole, findByText } = renderScreen(<LobbyingListeScreen />, {
      routes: routes(),
      pathname: "/lobbying",
    });
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("Lobbying");
    expect(await findByRole("link", { name: "Cabinet Conseil Exemple" })).toHaveAttribute(
      "href",
      `/lobbying/${lobbyisteExemple2.id}`,
    );
    expect(getByRole("link", { name: /Suivant/ })).toHaveAttribute("href", "/lobbying?page=2");
    expect(await findByText("Actions déclarées")).toBeInTheDocument();
    expect(await findByText("Calculée par CLAIR", { exact: false })).toBeInTheDocument();
    expect(
      await findByRole("heading", { name: "Présenter nos propositions sur les jardins partagés" }),
    ).toBeInTheDocument();
    expect(getByRole("link", { name: /Voir toutes les actions/ })).toHaveAttribute(
      "href",
      "/lobbying/actions",
    );
  });

  it("garde le type et le tri dans l'URL et revient en page 1", async () => {
    const { getByLabelText, visited } = renderScreen(
      <LobbyingListeScreen params={{ secteurs: "environnement", page: "2" }} />,
      { routes: routes(), pathname: "/lobbying" },
    );
    fireEvent.change(getByLabelText("Type"), { target: { value: "syndicat" } });
    fireEvent.change(getByLabelText("Trier par"), { target: { value: "budget-desc" } });
    expect(visited).toEqual([
      "/lobbying?type=syndicat&secteurs=environnement",
      "/lobbying?secteurs=environnement&sort=budget&order=desc",
    ]);
  });

  it("transmet la recherche à l'URL", async () => {
    const { getByRole, visited } = renderScreen(<LobbyingListeScreen />, {
      routes: routes(),
      pathname: "/lobbying",
    });
    fireEvent.change(getByRole("searchbox", { name: "Rechercher un représentant d'intérêts" }), {
      target: { value: "jardins" },
    });
    await waitFor(() => expect(visited).toEqual(["/lobbying?search=jardins"]));
  });

  it("propose d'effacer les filtres quand rien ne correspond", async () => {
    const { findByText, getByRole, visited } = renderScreen(
      <LobbyingListeScreen params={{ type: "syndicat", sort: "actions", order: "desc" }} />,
      { routes: routes([], 0), pathname: "/lobbying" },
    );
    expect(await findByText("Aucun représentant d'intérêts trouvé")).toBeInTheDocument();
    fireEvent.click(getByRole("button", { name: "Effacer les filtres" }));
    expect(visited).toEqual(["/lobbying?sort=actions&order=desc"]);
  });

  it("signale une erreur et permet de réessayer", async () => {
    const { findByRole } = renderScreen(<LobbyingListeScreen />, {
      routes: { "/lobbying": () => Promise.reject(new Error("panne")) },
      pathname: "/lobbying",
    });
    expect(await findByRole("alert")).toBeInTheDocument();
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });
});
