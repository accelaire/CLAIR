import { ApiError } from "@clair/api-client";
import { fireEvent, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import {
  alliancesExemple,
  groupeDetailExemple,
  thematiquesExemple,
  votesExemple,
} from "./fixtures.ts";
import { GroupeFicheScreen } from "./GroupeFicheScreen.tsx";

const PATH = "/groupes/assemblee/gex";

const routes = {
  [PATH]: { data: groupeDetailExemple },
  [`${PATH}/votes`]: votesExemple,
  [`${PATH}/alliances`]: alliancesExemple,
  [`${PATH}/thematiques`]: thematiquesExemple,
};

const fiche = (params = {}) => <GroupeFicheScreen chambre="assemblee" slug="gex" params={params} />;

describe("GroupeFicheScreen", () => {
  it("annonce le chargement", () => {
    const { getByRole } = renderScreen(fiche(), {
      routes: { [PATH]: () => new Promise(() => {}) },
      pathname: PATH,
    });
    expect(getByRole("status")).toHaveTextContent("Chargement du groupe");
  });

  it("affiche le groupe, ses chiffres, ses votes et ses membres", async () => {
    const { findByRole, getByRole, getAllByText } = renderScreen(fiche(), {
      routes,
      pathname: PATH,
    });
    expect(await findByRole("heading", { level: 1 })).toHaveTextContent("GEX");
    expect(getAllByText("Calculée par CLAIR").length).toBeGreaterThan(0);
    expect(await findByRole("link", { name: /jardins partagés/ })).toHaveAttribute(
      "href",
      "/scrutins/42?chambre=assemblee&session=17",
    );
    expect(await findByRole("link", { name: "Groupe bis" })).toHaveAttribute(
      "href",
      "/groupes/assemblee/gbis",
    );
    expect(
      await findByRole("heading", { name: "Cohésion du groupe par thème" }),
    ).toBeInTheDocument();
    const membres = getByRole("table", { name: /Membres actifs/ });
    expect(within(membres).getByRole("link", { name: "Camille Exemple" })).toHaveAttribute(
      "href",
      "/deputes/camille-exemple",
    );
  });

  it("garde le filtre des scrutins et le tri des membres dans l'URL", async () => {
    const { findByRole, getByRole, visited } = renderScreen(
      <GroupeFicheScreen
        chambre="assemblee"
        slug="gex"
        params={{ legislature: "17" }}
        initialData={{ data: groupeDetailExemple }}
      />,
      { routes, pathname: PATH },
    );
    fireEvent.click(
      await findByRole("button", { name: "Seulement les scrutins demandés par le groupe" }),
    );
    fireEvent.click(getByRole("button", { name: /Présence/ }));
    expect(visited).toEqual([
      `${PATH}?legislature=17&initie=1`,
      `${PATH}?legislature=17&tri=presence`,
    ]);
  });

  it("signale l'absence de données de vote", async () => {
    const { findByText } = renderScreen(fiche(), {
      routes: {
        ...routes,
        [`${PATH}/votes`]: { data: { ...votesExemple.data, totalVotes: 0, scrutinsRecents: [] } },
        [`${PATH}/alliances`]: { data: { ...alliancesExemple.data, allies: [] } },
        [`${PATH}/thematiques`]: { data: { ...thematiquesExemple.data, thematiques: [] } },
      },
      pathname: PATH,
    });
    expect(await findByText("Aucune donnée de vote disponible")).toBeInTheDocument();
    expect(await findByText("Aucune donnée de proximité disponible")).toBeInTheDocument();
    expect(await findByText("Aucune donnée thématique disponible")).toBeInTheDocument();
  });

  it("affiche la page introuvable sur un 404", async () => {
    const { findByRole } = renderScreen(fiche(), {
      routes: { [PATH]: () => Promise.reject(new ApiError(404, PATH)) },
      pathname: PATH,
    });
    expect(await findByRole("heading", { level: 1 })).toHaveTextContent(
      /introuvable|n'existe pas|404/i,
    );
  });

  it("signale une autre erreur et permet de réessayer", async () => {
    const { findByRole } = renderScreen(fiche(), {
      routes: { [PATH]: () => Promise.reject(new Error("panne")) },
      pathname: PATH,
    });
    expect(await findByRole("alert")).toBeInTheDocument();
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });
});
