import { ApiError } from "@clair/api-client";
import { fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { CirconscriptionScreen } from "./CirconscriptionScreen.tsx";
import {
  apercuAvecCandidatures,
  apercuExemple,
  candidatsGironde,
  listeSortants,
  resultatsGirondeExemple,
  resultatsNationauxExemple,
} from "./fixtures.ts";
import { GraphiqueScreen } from "./GraphiqueScreen.tsx";
import { SenatorialesScreen } from "./SenatorialesScreen.tsx";

const routes = {
  "/senatoriales/2026": apercuExemple,
  "/senatoriales/2026/sortants": listeSortants(),
};

describe("SenatorialesScreen", () => {
  it("annonce le chargement sous le titre", () => {
    const { getByRole } = renderScreen(<SenatorialesScreen />, {
      routes: { "/senatoriales/2026": () => new Promise(() => undefined) },
    });
    expect(getByRole("heading", { level: 1 })).toHaveTextContent(
      "Sénatoriales du 27 septembre 2026",
    );
    expect(getByRole("status")).toHaveTextContent("Chargement des sénatoriales");
  });

  it("signale une erreur récupérable", async () => {
    const { findByRole } = renderScreen(<SenatorialesScreen />, {
      routes: {
        "/senatoriales/2026": () => {
          throw new ApiError(500, "/senatoriales/2026");
        },
      },
    });
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("reprend les données de la route : chiffres, index, sections par département", () => {
    const { getByRole, getAllByRole, getByText, queryByText } = renderScreen(
      <SenatorialesScreen initialData={{ apercu: apercuExemple, sortants: listeSortants() }} />,
      { pathname: "/senatoriales-2026", routes },
    );
    expect(getByText(/178 des 348 sièges du Sénat sont renouvelés/)).toBeInTheDocument();
    expect(getByText("sièges non concernés").closest("div")).toHaveTextContent("170");
    expect(getByRole("link", { name: /^Gironde 6 sièges$/ })).toHaveAttribute(
      "href",
      "/senatoriales-2026/gironde",
    );
    const titreAin = getByRole("heading", { level: 3, name: /Ain · 2 sièges/ });
    expect(within(titreAin).getByRole("link")).toHaveAttribute("href", "/senatoriales-2026/ain");
    expect(getAllByRole("link", { name: /Hervé Exemple/ })[0]).toHaveAttribute(
      "href",
      "/senateurs/hervé-exemple",
    );
    // Candidatures pas encore publiées : rien n'est affirmé sur les sortants.
    expect(queryByText("Ne se représente pas")).toBeNull();
    expect(getByText("Mandat interrompu")).toBeInTheDocument();
  });

  it("écrit la lecture choisie dans l'URL", () => {
    const { getByRole, visited } = renderScreen(
      <SenatorialesScreen initialData={{ apercu: apercuExemple, sortants: listeSortants() }} />,
      { pathname: "/senatoriales-2026", routes },
    );
    expect(getByRole("button", { name: "Département" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(getByRole("button", { name: "Présence" }));
    expect(visited).toContain("/senatoriales-2026?tri=presence");
  });

  it("affiche le graphique du tri, avec son tableau de données, et surligne une tranche", async () => {
    const { getByRole, findByRole } = renderScreen(
      <SenatorialesScreen
        params={{ tri: "presence" }}
        initialData={{ apercu: apercuExemple, sortants: listeSortants() }}
      />,
      { pathname: "/senatoriales-2026", routes },
    );
    expect(
      getByRole("heading", { level: 2, name: "Présence et loyauté des sortants" }),
    ).toBeVisible();
    expect(getByRole("table", { name: "Sortants par tranche de présence en séance" })).toBeTruthy();
    fireEvent.click(
      getByRole("button", { name: /Surligner les sortants : présence en séance moins de 50 %/ }),
    );
    expect(await findByRole("status")).toHaveTextContent("moins de 50 % — 1 sortant surligné");
    expect(getByRole("link", { name: /Camille Fictif \(surligné\)/ })).toBeInTheDocument();
  });

  it("filtre par nom dans le navigateur", () => {
    const { getAllByRole, queryByText } = renderScreen(
      <SenatorialesScreen
        params={{ search: "camille" }}
        initialData={{ apercu: apercuAvecCandidatures, sortants: listeSortants() }}
      />,
      { routes },
    );
    expect(getAllByRole("link", { name: /Camille Fictif/ }).length).toBeGreaterThan(0);
    expect(queryByText("Hervé Exemple")).toBeNull();
  });

  it("montre les résultats dès que le scrutin a commencé", () => {
    const { getByRole, getByText } = renderScreen(
      <SenatorialesScreen
        initialData={{ apercu: apercuExemple, sortants: listeSortants() }}
        resultats={resultatsNationauxExemple}
      />,
      { routes },
    );
    expect(getByRole("heading", { name: "Suivi du scrutin" })).toBeInTheDocument();
    expect(getByText("En direct")).toBeInTheDocument();
    expect(getByText(/Résultats provisoires/)).toBeInTheDocument();
    expect(
      getByRole("table", { name: "Sièges par famille politique, avant et après le scrutin" }),
    ).toBeInTheDocument();
  });

  it("annonce les candidatures publiées", () => {
    const { getByRole, getAllByText } = renderScreen(
      <SenatorialesScreen
        initialData={{ apercu: apercuAvecCandidatures, sortants: listeSortants() }}
      />,
      { routes },
    );
    expect(getByRole("heading", { name: "Qui remet son siège en jeu ?" })).toBeInTheDocument();
    expect(getAllByText("Ne se représente pas")).toHaveLength(2);
    expect(getAllByText("Se représente")).toHaveLength(1);
  });
});

describe("CirconscriptionScreen", () => {
  it("avant le scrutin : candidats et sortants", async () => {
    const { getByRole, findByRole } = renderScreen(
      <CirconscriptionScreen
        circonscription={{ code: "33", nom: "Gironde", nbSieges: 6 }}
        nbCirconscriptions={64}
        maintenant="2026-09-20T12:00:00+02:00"
      />,
      {
        routes: {
          "/senatoriales/2026/sortants": listeSortants(),
          "/senatoriales/2026/candidats": candidatsGironde,
        },
      },
    );
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("Sénatoriales 2026 en Gironde");
    expect(await findByRole("heading", { name: "2 candidats en Gironde" })).toBeInTheDocument();
    expect(getByRole("link", { name: "Dominique Modèle" })).toHaveAttribute(
      "href",
      "/senateurs/dominique-modele",
    );
    expect(getByRole("link", { name: /Voir les 64 départements/ })).toHaveAttribute(
      "href",
      "/senatoriales-2026",
    );
  });

  it("résultats publiés au proportionnel", async () => {
    const { getByRole, getByText } = renderScreen(
      <CirconscriptionScreen
        circonscription={{ code: "33", nom: "Gironde", nbSieges: 6 }}
        nbCirconscriptions={64}
        maintenant={resultatsGirondeExemple.maintenant}
        resultats={resultatsGirondeExemple}
        initialData={{ sortants: listeSortants(), candidats: candidatsGironde }}
      />,
    );
    expect(getByText("Liste arrivée en tête")).toBeInTheDocument();
    expect(getByRole("heading", { name: "Comment les 6 sièges ont été répartis" })).toBeVisible();
    expect(getByRole("heading", { name: "Le sort des 3 sénateurs sortants" })).toBeVisible();
    expect(getByText("Réélu le 27 septembre")).toBeInTheDocument();
    expect(getByText(/Résultats provisoires/)).toBeInTheDocument();
  });
});

describe("GraphiqueScreen", () => {
  it("rend le graphique en titre de page, avec les autres lectures", async () => {
    const { getByRole, findByRole } = renderScreen(<GraphiqueScreen slug="ages" />, { routes });
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("L’âge des sortants");
    expect(getByRole("link", { name: "Départements" })).toHaveAttribute(
      "href",
      "/senatoriales-2026/graphiques/carte",
    );
    expect(
      await findByRole("table", { name: "Sortants par tranche d'âge et par sexe" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(getByRole("link", { name: /Télécharger l'image/ })).toHaveAttribute(
        "href",
        "/senatoriales-2026/graphiques/ages/image",
      ),
    );
  });
});
