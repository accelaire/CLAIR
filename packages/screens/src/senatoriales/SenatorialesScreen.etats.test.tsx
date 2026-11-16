import { ApiError } from "@clair/api-client";
import type { ApercuSenatoriales, TriSortants } from "@clair/data";
import { fireEvent, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import {
  apercuAvecCandidatures,
  apercuExemple,
  listeSortants,
  resultatsNationauxExemple,
  sortantsExemple,
} from "./fixtures.ts";
import { SenatorialesScreen } from "./SenatorialesScreen.tsx";

/* Données FICTIVES dérivées des fixtures de la rubrique. */

const routes = {
  "/senatoriales/2026": apercuExemple,
  "/senatoriales/2026/sortants": listeSortants(),
};
const initialData = { apercu: apercuExemple, sortants: listeSortants() };

describe("SenatorialesScreen, états et lectures", () => {
  it("sortants en chargement sous l'aperçu", () => {
    const { getByText } = renderScreen(
      <SenatorialesScreen initialData={{ apercu: apercuExemple }} />,
      {
        routes: { "/senatoriales/2026/sortants": () => new Promise(() => undefined) },
      },
    );
    expect(getByText("Chargement des sortants…")).toBeInTheDocument();
  });

  it("sortants en erreur : message et bouton pour réessayer", async () => {
    const { findByText, getByRole } = renderScreen(
      <SenatorialesScreen initialData={{ apercu: apercuExemple }} />,
      {
        routes: {
          "/senatoriales/2026/sortants": () => {
            throw new ApiError(500, "/senatoriales/2026/sortants");
          },
        },
      },
    );
    expect(
      await findByText("Une erreur est survenue lors du chargement des sortants."),
    ).toBeInTheDocument();
    expect(getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("recherche sans résultat : message vide et graphique masqué", () => {
    const { getByText, queryByRole } = renderScreen(
      <SenatorialesScreen
        params={{ search: "introuvable", tri: "age" }}
        initialData={initialData}
      />,
      { routes },
    );
    expect(getByText("Aucun sortant ne correspond aux critères.")).toBeInTheDocument();
    expect(queryByRole("heading", { name: "L’âge des sortants" })).toBeNull();
  });

  it.each<[TriSortants, string]>([
    ["groupe", "Ce que chaque groupe remet en jeu"],
    ["commission", "Les sortants par commission"],
    ["profession", "D’où viennent les sortants"],
    ["age", "L’âge des sortants"],
    ["loyaute", "Présence et loyauté des sortants"],
    ["amendements", "Interventions et amendements"],
    ["interventions", "Interventions et amendements"],
  ])("tri « %s » : le graphique « %s »", (tri, titre) => {
    const { getByRole } = renderScreen(
      <SenatorialesScreen params={{ tri }} initialData={initialData} />,
      { routes },
    );
    expect(getByRole("heading", { level: 2, name: titre })).toBeInTheDocument();
  });

  it("tri par groupe : sections ancrées dans la page, sans lien de circonscription", () => {
    const { getByRole } = renderScreen(
      <SenatorialesScreen params={{ tri: "groupe" }} initialData={initialData} />,
      { routes },
    );
    const titre = getByRole("heading", { level: 3, name: /Groupe Exemple A · 2 sièges/ });
    expect(within(titre).getByRole("link")).toHaveAttribute("href", "#groupe-exemple-a");
    const sansGroupe = getByRole("heading", { level: 3, name: /Sans groupe · 1 siège$/ });
    expect(within(sansGroupe).getByRole("link")).toHaveAttribute("href", "#sans-groupe");
  });

  it("tri par nom : une seule liste, sans section ni graphique", () => {
    const { queryAllByRole, getAllByRole } = renderScreen(
      <SenatorialesScreen params={{ tri: "nom" }} initialData={initialData} />,
      { routes },
    );
    expect(queryAllByRole("heading", { level: 3, name: /siège/ })).toHaveLength(0);
    expect(getAllByRole("link", { name: /Hervé Exemple/ }).length).toBeGreaterThan(0);
  });

  it("filtres actifs : le sous-titre du graphique dit sur combien de sortants il est calculé", () => {
    const { getByText } = renderScreen(
      <SenatorialesScreen
        params={{ tri: "age", departement: "01" }}
        initialData={{
          apercu: apercuExemple,
          sortants: listeSortants(sortantsExemple.slice(0, 2)),
          tousSortants: sortantsExemple,
        }}
      />,
      { routes },
    );
    expect(getByText(/Calculé sur les 2 sortants correspondant aux filtres\./)).toBeInTheDocument();
  });

  it("changer de département ou de groupe écrit l'URL ; réinitialiser revient à la page nue", () => {
    const { getAllByRole, visited } = renderScreen(
      <SenatorialesScreen params={{ groupe: "groupe-exemple-a" }} initialData={initialData} />,
      { pathname: "/senatoriales-2026", routes },
    );
    const [departement] = getAllByRole("combobox", { name: "Département" });
    const [groupe] = getAllByRole("combobox", { name: "Groupe" });
    if (!departement || !groupe) throw new Error("filtres introuvables");
    fireEvent.change(departement, { target: { value: "33" } });
    expect(visited).toContain("/senatoriales-2026?departement=33&groupe=groupe-exemple-a");
    fireEvent.change(groupe, { target: { value: "" } });
    expect(visited).toContain("/senatoriales-2026");
    const [reinitialiser] = getAllByRole("button", { name: "Réinitialiser" });
    if (!reinitialiser) throw new Error("bouton introuvable");
    fireEvent.click(reinitialiser);
    expect(visited.at(-1)).toBe("/senatoriales-2026");
  });

  it("source sans adresse en texte simple ; aucun ancien parlementaire parmi les candidats", () => {
    const apercu: ApercuSenatoriales = {
      ...apercuAvecCandidatures,
      scrutin: { ...apercuAvecCandidatures.scrutin, sources: [{ label: "Décret fictif" }] },
      candidatures: apercuAvecCandidatures.candidatures
        ? { ...apercuAvecCandidatures.candidatures, anciensParlementaires: 0 }
        : null,
    };
    const { getByText, queryByRole, queryByText } = renderScreen(
      <SenatorialesScreen initialData={{ apercu, sortants: listeSortants() }} />,
      { routes },
    );
    expect(getByText("Décret fictif")).toBeInTheDocument();
    expect(queryByRole("link", { name: "Décret fictif" })).toBeNull();
    expect(queryByText(/déjà passés par le Parlement/)).toBeNull();
    expect(getByText(/Les candidats, circonscription par circonscription/)).toBeInTheDocument();
  });

  it("aucune source : pas de liste de sources", () => {
    const apercu: ApercuSenatoriales = {
      ...apercuExemple,
      scrutin: { ...apercuExemple.scrutin, sources: [] },
    };
    const { queryByText } = renderScreen(
      <SenatorialesScreen initialData={{ apercu, sortants: listeSortants() }} />,
      { routes },
    );
    expect(queryByText("Source fictive")).toBeNull();
  });

  it("résultats tous en « pas ouvert » : la page reste celle d'avant le scrutin", () => {
    const { queryByRole } = renderScreen(
      <SenatorialesScreen
        initialData={initialData}
        resultats={{
          ...resultatsNationauxExemple,
          circonscriptions: resultatsNationauxExemple.circonscriptions.map((c) => ({
            ...c,
            statut: "pas_ouvert" as const,
          })),
        }}
      />,
      { routes },
    );
    expect(queryByRole("heading", { name: "Suivi du scrutin" })).toBeNull();
  });

  it("la surbrillance née d'un graphique se retire", async () => {
    const { getByRole, findByRole, queryByRole } = renderScreen(
      <SenatorialesScreen params={{ tri: "presence" }} initialData={initialData} />,
      { pathname: "/senatoriales-2026", routes },
    );
    fireEvent.click(
      getByRole("button", {
        name: /Surligner les sortants : présence aux votes solennels moins de 50 %/,
      }),
    );
    expect(await findByRole("status")).toHaveTextContent("1 sortant surligné dans la liste");
    fireEvent.click(getByRole("button", { name: "Retirer la surbrillance" }));
    expect(queryByRole("button", { name: "Retirer la surbrillance" })).toBeNull();
  });
});
