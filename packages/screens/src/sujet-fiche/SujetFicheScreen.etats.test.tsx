import type { SujetDocumentLie } from "@clair/data";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { routesSujetExemple, SLUG_EXEMPLE, sujetExemple } from "./fixtures.ts";
import { SujetFicheScreen } from "./SujetFicheScreen.tsx";

const pathname = `/sujets/${SLUG_EXEMPLE}`;

// Document lié fictif.
const documentLie: SujetDocumentLie = {
  uid: "RAPPORT-EXEMPLE-1",
  titre: "Rapport d'exemple sur les jardins partagés",
  procedureLibelle: "Rapport",
  urlAN: null,
  urlSenat: null,
  chambre: "assemblee",
  dateDepot: null,
  loiRef: "exemple",
};

describe("SujetFicheScreen : états", () => {
  it("répond 404 quand l'API ne renvoie pas de sujet", async () => {
    const { findByRole } = renderScreen(<SujetFicheScreen slug={SLUG_EXEMPLE} />, {
      pathname,
      routes: { [pathname]: { data: undefined } },
    });
    expect(await findByRole("heading", { level: 1 })).toHaveTextContent("Page introuvable");
  });

  it("sujet promulgué sans catégorie, description ni dates de vote", async () => {
    const sujet = {
      ...sujetExemple,
      status: "promulgue",
      category: null,
      description: null,
      dateDebut: null,
      dateDernierVote: null,
      dateFin: "2026-06-01T00:00:00.000Z",
    };
    const { findByRole, queryByText, getByText } = renderScreen(
      <SujetFicheScreen slug={SLUG_EXEMPLE} initialData={{ sujet: { data: sujet } }} />,
      { pathname, routes: routesSujetExemple },
    );
    expect(await findByRole("heading", { level: 1 })).toHaveTextContent(sujetExemple.label);
    expect(queryByText("Exemple", { selector: "span" })).toBeNull();
    expect(queryByText("Sujet fictif servant d'exemple.")).toBeNull();
    expect(getByText(/^Promulgué le/)).toBeInTheDocument();
    expect(queryByText(/Déposé le/)).toBeNull();
  });

  it("sans aucune date, n'affiche pas la ligne des dates", async () => {
    const sujet = { ...sujetExemple, dateDebut: null, dateDernierVote: null };
    const { findByRole, queryByText } = renderScreen(
      <SujetFicheScreen slug={SLUG_EXEMPLE} initialData={{ sujet: { data: sujet } }} />,
      { pathname, routes: routesSujetExemple },
    );
    expect(await findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(queryByText(/Déposé le|Dernier vote le|Promulgué le/)).toBeNull();
  });

  it("liste les documents liés", async () => {
    const { findByRole } = renderScreen(<SujetFicheScreen slug={SLUG_EXEMPLE} />, {
      pathname,
      routes: {
        ...routesSujetExemple,
        [`${pathname}/documents-lies`]: { data: [documentLie] },
      },
    });
    expect(await findByRole("heading", { name: /Documents liés/ })).toHaveTextContent("(1)");
  });
});
