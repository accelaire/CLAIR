import type { FixtureRoutes } from "@clair/api-client";
import type { LobbyingActionListItem } from "@clair/data";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { actionExemple, pageActions, secteursExemple } from "../lobbying-liste/fixtures.ts";
import { renderScreen } from "../test-utils.tsx";
import { LobbyingActionsScreen } from "./LobbyingActionsScreen.tsx";

const pathname = "/lobbying/actions";
const routes = (actions: LobbyingActionListItem[] = [actionExemple]): FixtureRoutes => ({
  "/lobbying/actions": pageActions(actions),
  "/lobbying/secteurs": secteursExemple,
});

describe("LobbyingActionsScreen : cas limites", () => {
  it("compte une seule action filtrée et nomme chaque filtre actif", async () => {
    const { findByText, getByText } = renderScreen(
      <LobbyingActionsScreen
        params={{
          cible: "ministre",
          texteVise: "Actes réglementaires",
          secteurs: "agriculture,secteur-inconnu",
          dateFrom: "2026-01-01",
          dateTo: "2026-03-31",
        }}
      />,
      { routes: routes(), pathname },
    );
    expect(
      await findByText(/^1 action de lobbying correspondant aux filtres$/),
    ).toBeInTheDocument();
    expect(getByText("Cible : Gouvernement")).toBeInTheDocument();
    expect(getByText("Texte visé : Actes réglementaires")).toBeInTheDocument();
    expect(getByText("Secteur : Agriculture")).toBeInTheDocument();
    expect(getByText("Secteur : secteur-inconnu")).toBeInTheDocument();
    expect(getByText(/^Période du 1 janv\. 2026 au 31 mars 2026$/)).toBeInTheDocument();
  });

  it("écrit une période ouverte d'un seul côté", async () => {
    const debut = renderScreen(<LobbyingActionsScreen params={{ dateFrom: "2026-01-01" }} />, {
      routes: routes(),
      pathname,
    });
    expect(await debut.findByText(/^Période du 1 janv\. 2026$/)).toBeInTheDocument();
    debut.unmount();
    const fin = renderScreen(<LobbyingActionsScreen params={{ dateTo: "2026-03-31" }} />, {
      routes: routes(),
      pathname,
    });
    expect(await fin.findByText(/^Période au 31 mars 2026$/)).toBeInTheDocument();
  });

  it("retire chaque filtre actif depuis sa pastille", async () => {
    const { findByRole, getByRole, visited } = renderScreen(
      <LobbyingActionsScreen
        params={{
          cible: "ministre",
          texteVise: "Actes réglementaires",
          secteurs: "agriculture,environnement",
          dateFrom: "2026-01-01",
        }}
      />,
      { routes: routes(), pathname },
    );
    const secteur = await findByRole("button", { name: /Retirer le filtre Secteur : Agriculture/ });
    fireEvent.click(getByRole("button", { name: /Retirer le filtre Cible/ }));
    fireEvent.click(getByRole("button", { name: /Retirer le filtre Texte visé/ }));
    fireEvent.click(secteur);
    fireEvent.click(getByRole("button", { name: /Retirer le filtre Période/ }));
    expect(visited).toEqual([
      "/lobbying/actions?texteVise=Actes+r%C3%A9glementaires&secteurs=agriculture%2Cenvironnement&dateFrom=2026-01-01",
      "/lobbying/actions?cible=ministre&secteurs=agriculture%2Cenvironnement&dateFrom=2026-01-01",
      "/lobbying/actions?cible=ministre&texteVise=Actes+r%C3%A9glementaires&secteurs=environnement&dateFrom=2026-01-01",
      "/lobbying/actions?cible=ministre&texteVise=Actes+r%C3%A9glementaires&secteurs=agriculture%2Cenvironnement",
    ]);
  });

  it("réinitialise les filtres en gardant la recherche", async () => {
    const { findAllByRole, visited } = renderScreen(
      <LobbyingActionsScreen params={{ cible: "ministre", search: "fictif" }} />,
      { routes: routes(), pathname },
    );
    const [reinitialiser] = await findAllByRole("button", { name: "Réinitialiser" });
    if (reinitialiser) fireEvent.click(reinitialiser);
    expect(visited).toEqual(["/lobbying/actions?search=fictif"]);
  });

  it("revient à toutes les cibles et au tri par date décroissante", async () => {
    const { getByLabelText, visited } = renderScreen(
      <LobbyingActionsScreen params={{ cible: "ministre", sort: "lobbyiste", order: "asc" }} />,
      { routes: routes(), pathname },
    );
    fireEvent.change(getByLabelText("Cible"), { target: { value: "" } });
    fireEvent.change(getByLabelText("Trier par"), { target: { value: "dateDebut-desc" } });
    expect(visited).toEqual([
      "/lobbying/actions?sort=lobbyiste&order=asc",
      "/lobbying/actions?cible=ministre",
    ]);
  });

  it("sans filtre ni action, l'annonce sans bouton", async () => {
    const { findByText, queryByRole } = renderScreen(<LobbyingActionsScreen />, {
      routes: { ...routes([]), "/lobbying/secteurs": { data: [] } },
      pathname,
    });
    expect(
      await findByText("Aucune action de lobbying n'est disponible pour le moment."),
    ).toBeInTheDocument();
    expect(queryByRole("button", { name: "Effacer les filtres" })).toBeNull();
  });
});
