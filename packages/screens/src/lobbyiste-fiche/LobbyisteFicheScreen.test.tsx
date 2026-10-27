import { ApiError } from "@clair/api-client";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { lobbyisteDetailExemple } from "../lobbying-liste/fixtures.ts";
import { renderScreen } from "../test-utils.tsx";
import { LobbyisteFicheScreen, siteWebHref } from "./LobbyisteFicheScreen.tsx";

const ID = lobbyisteDetailExemple.id;
const CHEMIN = `/lobbying/${ID}`;

describe("LobbyisteFicheScreen", () => {
  it("annonce le chargement", () => {
    const { getByRole } = renderScreen(<LobbyisteFicheScreen id={ID} />, {
      routes: { [CHEMIN]: () => new Promise(() => {}) },
      pathname: CHEMIN,
    });
    expect(getByRole("status")).toHaveTextContent("Chargement du représentant");
  });

  it("affiche l'identité, les chiffres et les actions déclarées", async () => {
    const { findByRole, getByRole, getByText } = renderScreen(<LobbyisteFicheScreen id={ID} />, {
      routes: { [CHEMIN]: { data: lobbyisteDetailExemple } },
      pathname: CHEMIN,
    });
    expect(await findByRole("heading", { level: 1 })).toHaveTextContent(
      "Fédération d'exemple des jardins partagés",
    );
    expect(getByText("Association")).toBeInTheDocument();
    expect(getByText("Donnée officielle", { exact: false })).toBeInTheDocument();
    expect(
      getByRole("heading", { level: 2, name: /Actions de lobbying \(2\)/ }),
    ).toBeInTheDocument();
    expect(getByRole("link", { name: "Camille Exemple" })).toHaveAttribute(
      "href",
      "/deputes/camille-exemple",
    );
    expect(getByRole("link", { name: /exemple\.invalid/ })).toHaveAttribute(
      "href",
      "https://exemple.invalid/",
    );
  });

  it("filtre les actions sur la période lue dans l'URL", () => {
    const { getByRole, queryByRole } = renderScreen(
      <LobbyisteFicheScreen
        id={ID}
        params={{ dateFrom: "2026-01-01" }}
        initialData={{ data: lobbyisteDetailExemple }}
      />,
      { routes: {}, pathname: CHEMIN },
    );
    expect(getByRole("heading", { level: 2, name: /\(1 sur 2\)/ })).toBeInTheDocument();
    expect(queryByRole("heading", { name: /projet de décret/ })).not.toBeInTheDocument();
  });

  it("propose de retirer une période sans action", () => {
    const { getByText, getByRole, visited } = renderScreen(
      <LobbyisteFicheScreen
        id={ID}
        params={{ dateFrom: "2027-01-01", dateTo: "2027-12-31" }}
        initialData={{ data: lobbyisteDetailExemple }}
      />,
      { routes: {}, pathname: CHEMIN },
    );
    expect(getByText("Aucune action sur cette période")).toBeInTheDocument();
    fireEvent.click(getByRole("button", { name: "Retirer la période" }));
    expect(visited).toEqual([CHEMIN]);
  });

  it("affiche la page introuvable sur un 404", async () => {
    const { findByRole } = renderScreen(<LobbyisteFicheScreen id={ID} />, {
      routes: { [CHEMIN]: () => Promise.reject(new ApiError(404, CHEMIN)) },
      pathname: CHEMIN,
    });
    expect(await findByRole("heading", { level: 1 })).toHaveTextContent(/introuvable/i);
  });

  it("signale une autre erreur et permet de réessayer", async () => {
    const { findByRole } = renderScreen(<LobbyisteFicheScreen id={ID} />, {
      routes: { [CHEMIN]: () => Promise.reject(new Error("panne")) },
      pathname: CHEMIN,
    });
    expect(await findByRole("alert")).toBeInTheDocument();
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("n'accepte que des sites en http(s)", () => {
    expect(siteWebHref("www.exemple.invalid")).toBe("https://www.exemple.invalid/");
    expect(siteWebHref("javascript:alert(1)")).toBeNull();
    expect(siteWebHref(null)).toBeNull();
  });
});
