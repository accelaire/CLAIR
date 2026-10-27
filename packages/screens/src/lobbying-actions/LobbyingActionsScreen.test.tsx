import { fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  actionExemple,
  actionExemple2,
  lobbyisteExemple,
  pageActions,
  secteursExemple,
} from "../lobbying-liste/fixtures.ts";
import { renderScreen } from "../test-utils.tsx";
import { LobbyingActionsScreen } from "./LobbyingActionsScreen.tsx";

const routes = (actions = [actionExemple, actionExemple2], totalPages = 2) => ({
  "/lobbying/actions": pageActions(actions, { totalPages }),
  "/lobbying/secteurs": secteursExemple,
});

describe("LobbyingActionsScreen", () => {
  it("annonce le chargement", () => {
    const { getByRole } = renderScreen(<LobbyingActionsScreen />, {
      routes: { "/lobbying/actions": () => new Promise(() => {}) },
      pathname: "/lobbying/actions",
    });
    expect(getByRole("status")).toHaveTextContent("Chargement des actions");
  });

  it("liste les actions avec leur auteur et une pagination en liens", async () => {
    const { findByRole, getAllByRole, getByRole } = renderScreen(<LobbyingActionsScreen />, {
      routes: routes(),
      pathname: "/lobbying/actions",
    });
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("Actions de lobbying");
    expect(
      await findByRole("heading", {
        level: 2,
        name: "Présenter nos propositions sur les jardins partagés",
      }),
    ).toBeInTheDocument();
    expect(getAllByRole("link", { name: lobbyisteExemple.nom })[0]).toHaveAttribute(
      "href",
      `/lobbying/${lobbyisteExemple.id}`,
    );
    expect(getByRole("link", { name: /Suivant/ })).toHaveAttribute(
      "href",
      "/lobbying/actions?page=2",
    );
  });

  it("garde la cible, le texte visé et le tri dans l'URL", async () => {
    const { getByLabelText, visited } = renderScreen(
      <LobbyingActionsScreen params={{ dateFrom: "2026-01-01", page: "3" }} />,
      { routes: routes(), pathname: "/lobbying/actions" },
    );
    fireEvent.change(getByLabelText("Cible"), { target: { value: "ministre" } });
    fireEvent.change(getByLabelText("Texte visé"), { target: { value: "Actes réglementaires" } });
    fireEvent.change(getByLabelText("Trier par"), { target: { value: "lobbyiste-asc" } });
    expect(visited).toEqual([
      "/lobbying/actions?cible=ministre&dateFrom=2026-01-01",
      "/lobbying/actions?texteVise=Actes+r%C3%A9glementaires&dateFrom=2026-01-01",
      "/lobbying/actions?sort=lobbyiste&order=asc&dateFrom=2026-01-01",
    ]);
  });

  it("transmet la recherche à l'URL", async () => {
    const { getByRole, visited } = renderScreen(<LobbyingActionsScreen />, {
      routes: routes(),
      pathname: "/lobbying/actions",
    });
    fireEvent.change(getByRole("searchbox", { name: "Rechercher une action ou un représentant" }), {
      target: { value: "eau" },
    });
    await waitFor(() => expect(visited).toEqual(["/lobbying/actions?search=eau"]));
  });

  it("propose d'effacer les filtres quand rien ne correspond", async () => {
    const { findByText, getByRole, visited } = renderScreen(
      <LobbyingActionsScreen params={{ cible: "presidence", search: "x" }} />,
      { routes: routes([], 0), pathname: "/lobbying/actions" },
    );
    expect(await findByText("Aucune action trouvée")).toBeInTheDocument();
    fireEvent.click(getByRole("button", { name: "Effacer les filtres" }));
    expect(visited).toEqual(["/lobbying/actions"]);
  });

  it("signale une erreur et permet de réessayer", async () => {
    const { findByRole } = renderScreen(<LobbyingActionsScreen />, {
      routes: { "/lobbying/actions": () => Promise.reject(new Error("panne")) },
      pathname: "/lobbying/actions",
    });
    expect(await findByRole("alert")).toBeInTheDocument();
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });
});
