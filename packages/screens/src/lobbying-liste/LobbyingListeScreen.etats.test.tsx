import type { FixtureRoutes } from "@clair/api-client";
import type { LobbyisteListItem } from "@clair/data";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { lobbyisteExemple, pageLobbyistes, secteursExemple, statsExemple } from "./fixtures.ts";
import { LobbyingListeScreen } from "./LobbyingListeScreen.tsx";

const routes = (lobbyistes: LobbyisteListItem[] = [lobbyisteExemple]): FixtureRoutes => ({
  "/lobbying": pageLobbyistes(lobbyistes),
  "/lobbying/secteurs": secteursExemple,
  "/lobbying/stats": statsExemple,
  "/lobbying/actions/recent": { data: [] },
});

describe("LobbyingListeScreen : cas limites", () => {
  it("compte un seul représentant, filtré, et nomme les secteurs choisis", async () => {
    const { findByText, getByText } = renderScreen(
      <LobbyingListeScreen params={{ secteurs: "environnement,secteur-inconnu" }} />,
      { routes: routes(), pathname: "/lobbying" },
    );
    expect(
      await findByText(/^1 représentant d'intérêts correspondant aux filtres$/),
    ).toBeInTheDocument();
    expect(getByText("Secteur : Environnement")).toBeInTheDocument();
    expect(getByText("Secteur : secteur-inconnu")).toBeInTheDocument();
  });

  it("retire un secteur et le type depuis les filtres actifs", async () => {
    const { findByRole, getByRole, visited } = renderScreen(
      <LobbyingListeScreen params={{ type: "cabinet", secteurs: "environnement,agriculture" }} />,
      { routes: routes(), pathname: "/lobbying" },
    );
    fireEvent.click(await findByRole("button", { name: /Retirer.*Secteur : Agriculture/ }));
    fireEvent.click(getByRole("button", { name: /Retirer.*Type : Cabinet de conseil/ }));
    expect(visited).toEqual([
      "/lobbying?type=cabinet&secteurs=environnement",
      "/lobbying?secteurs=environnement%2Cagriculture",
    ]);
  });

  it("remet les filtres à zéro", async () => {
    const { findAllByRole, visited } = renderScreen(
      <LobbyingListeScreen params={{ type: "cabinet", search: "fictif" }} />,
      { routes: routes(), pathname: "/lobbying" },
    );
    const [reinitialiser] = await findAllByRole("button", { name: "Réinitialiser" });
    if (reinitialiser) fireEvent.click(reinitialiser);
    expect(visited).toEqual(["/lobbying?search=fictif"]);
  });

  it("revient à tous les types et lit un tri croissant", async () => {
    const { getByLabelText, visited } = renderScreen(
      <LobbyingListeScreen params={{ type: "cabinet" }} />,
      {
        routes: routes(),
        pathname: "/lobbying",
      },
    );
    fireEvent.change(getByLabelText("Type"), { target: { value: "" } });
    fireEvent.change(getByLabelText("Trier par"), { target: { value: "actions-asc" } });
    expect(visited).toEqual(["/lobbying", "/lobbying?type=cabinet&sort=actions&order=asc"]);
  });

  it("sans filtre ni données, annonce un répertoire indisponible sans bouton", async () => {
    const { findByText, queryByRole, queryByText } = renderScreen(<LobbyingListeScreen />, {
      routes: {
        ...routes([]),
        "/lobbying/stats": { data: { ...statsExemple.data, totalLobbyistes: 0 } },
      },
      pathname: "/lobbying",
    });
    expect(await findByText("Le répertoire n'est pas encore disponible.")).toBeInTheDocument();
    expect(queryByRole("button", { name: "Effacer les filtres" })).toBeNull();
    expect(queryByText("Chiffres clés")).toBeNull();
    expect(queryByText("Dernières actions déclarées")).toBeNull();
  });
});
