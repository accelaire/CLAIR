import type { FixtureRoutes } from "@clair/api-client";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { ficheExemple, ficheReponse, page, votesExemple } from "./fixtures.ts";
import { metaFiche } from "./meta.ts";
import { ParlementaireFicheScreen } from "./ParlementaireFicheScreen.tsx";

const pathname = "/deputes/camille-exemple";
const routes: FixtureRoutes = {
  "/deputes/camille-exemple": ficheReponse,
  "/deputes/camille-exemple/votes": votesExemple,
  "/deputes/camille-exemple/amendements": page([]),
};

const rendre = (params = {}, autres: FixtureRoutes = routes) =>
  renderScreen(
    <ParlementaireFicheScreen chambre="assemblee" slug="camille-exemple" params={params} />,
    { pathname, routes: autres },
  );

describe("ParlementaireFicheScreen", () => {
  it("annonce le chargement", () => {
    const { getByRole } = rendre(
      {},
      { ...routes, "/deputes/camille-exemple": () => new Promise(() => {}) },
    );
    expect(getByRole("status")).toHaveTextContent("Chargement de la fiche");
  });

  it("présente l'élu, ses statistiques calculées, la synthèse IA et ses votes", async () => {
    const { findByRole, getByRole, getByText, getAllByText } = rendre();
    expect(await findByRole("heading", { level: 1 })).toHaveTextContent("Camille Exemple");
    expect(getByText("2e circonscription (99)")).toBeInTheDocument();
    expect(getByRole("heading", { name: "Statistiques" })).toBeInTheDocument();
    expect(getByText("Calculée par CLAIR")).toBeInTheDocument();
    expect(getAllByText("Générée par IA, à vérifier")).toHaveLength(1);
    expect(getByRole("tab", { name: "Votes", selected: true })).toBeInTheDocument();
    expect(
      await findByRole("link", { name: "L'ensemble du projet de loi exemple" }),
    ).toHaveAttribute("href", "/scrutins/42?chambre=assemblee&session=17");
    expect(getByText(/position majoritaire du groupe \(Pour\)/)).toBeInTheDocument();
    expect(getByRole("link", { name: /Suivant/ })).toHaveAttribute(
      "href",
      "/deputes/camille-exemple?page=2",
    );
  });

  it("écrit l'onglet et les filtres dans l'URL", async () => {
    const { findByRole, getByLabelText, visited } = rendre({ page: "2" });
    fireEvent.click(await findByRole("tab", { name: /Déclarations HATVP/ }));
    fireEvent.click(getByLabelText("Uniquement les votes différents de la position du groupe"));
    expect(visited).toEqual([
      "/deputes/camille-exemple?onglet=declarations",
      "/deputes/camille-exemple?dissidents=1",
    ]);
  });

  it("affiche l'état vide d'un onglet", async () => {
    const { findByText } = rendre({ onglet: "amendements" });
    expect(await findByText("Aucun amendement trouvé pour ces critères.")).toBeInTheDocument();
  });

  it("affiche les mandats et les déclarations depuis la fiche", async () => {
    const { findByRole, getByRole } = rendre({ onglet: "declarations" });
    expect(await findByRole("link", { name: /Consulter sur hatvp.fr/ })).toBeInTheDocument();
    expect(
      getByRole("heading", { name: "Déclaration d'intérêts et d'activités" }),
    ).toBeInTheDocument();
  });

  it("signale une erreur récupérable", async () => {
    const { findByRole } = rendre({}, {});
    expect(await findByRole("alert")).toHaveTextContent("Le chargement a échoué");
  });
});

describe("metaFiche", () => {
  it("décrit l'élu par des faits", () => {
    expect(metaFiche(ficheExemple, "assemblee")).toEqual({
      title: "Camille Exemple, députée — votes et activité",
      description:
        "Camille Exemple (EXE), députée. 120 votes, 4 interventions, 3 amendements déposés, 95 % de loyauté au groupe. Mis à jour chaque jour.",
    });
  });
});
