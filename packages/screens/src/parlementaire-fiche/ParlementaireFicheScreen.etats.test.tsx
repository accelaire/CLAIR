import { ApiError, type FixtureRoutes } from "@clair/api-client";
import type { ParlementaireDetail } from "@clair/data";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { ficheExemple, page, votesExemple } from "./fixtures.ts";
import { ParlementaireFicheScreen } from "./ParlementaireFicheScreen.tsx";

const [mandat] = ficheExemple.mandatsParlementaires;
if (!mandat) throw new Error("fixture sans mandat");

// Variantes FICTIVES : un ancien député passé aussi par le Sénat, sans statistiques ni déclaration.
const ancien: ParlementaireDetail = {
  ...ficheExemple,
  actif: false,
  declarations: [],
  mandatsParlementaires: [
    mandat,
    {
      ...mandat,
      id: "m-senat",
      chambre: "senat",
      legislature: null,
      mandature: 2017,
      dateDebut: "2017-10-01T00:00:00.000Z",
    },
  ],
};

const rendre = (fiche: unknown, params: Record<string, string> = {}, autres: FixtureRoutes = {}) =>
  renderScreen(
    <ParlementaireFicheScreen chambre="assemblee" slug="camille-exemple" params={params} />,
    {
      pathname: "/deputes/camille-exemple",
      routes: {
        "/deputes/camille-exemple": fiche,
        "/deputes/camille-exemple/votes": votesExemple,
        "/deputes/camille-exemple/amendements": page([]),
        ...autres,
      },
    },
  );

describe("ParlementaireFicheScreen, variantes", () => {
  it("propose de réessayer quand la fiche n'a pas pu être chargée", async () => {
    rendre(() => {
      throw new ApiError(500, "/deputes/camille-exemple");
    });
    expect(
      await screen.findByText(
        "La fiche n'a pas pu être chargée. Vérifiez votre connexion puis réessayez.",
      ),
    ).toBeInTheDocument();
  });

  it("titre le bilan d'un ancien élu et revient aux votes pour un onglet sans contenu", async () => {
    rendre({ data: ancien }, { onglet: "declarations", chambre: "senat", dateFrom: "2025-01-01" });
    expect(await screen.findByRole("heading", { name: "Bilan de son mandat" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Votes", selected: true })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Déclarations HATVP/ })).toBeNull();
    // Élu des deux chambres : le filtre de chambre est proposé.
    expect(await screen.findByRole("group", { name: "Chambre" })).toBeInTheDocument();
  });

  it("n'affiche pas de statistiques sans calcul et ouvre l'onglet des mandats", async () => {
    const { visited } = rendre({ data: { ...ficheExemple, stats: null } }, { onglet: "mandats" });
    expect(await screen.findByText("Mandats et fonctions")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Statistiques" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: /Amendements/ }));
    expect(visited).toEqual(["/deputes/camille-exemple?onglet=amendements"]);
  });

  it("titre le bilan de plusieurs mandats", async () => {
    rendre({
      data: {
        ...ficheExemple,
        actif: false,
        mandatsParlementaires: [mandat, { ...mandat, id: "m16", legislature: 16 }],
      },
    });
    expect(await screen.findByRole("heading", { name: "Bilan de ses mandats" })).toBeVisible();
  });
});
