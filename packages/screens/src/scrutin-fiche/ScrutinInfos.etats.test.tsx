import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { scrutinDetailExemple } from "./fixtures.ts";
import { demandeurs, ScrutinInfos, seanceHref } from "./ScrutinInfos.tsx";

/** Groupe FICTIF de la période (champs utiles à la recherche des noms). */
const groupeExemple = {
  id: "g1",
  slug: "gpa",
  chambre: "senat",
  nom: "GPA",
  nomComplet: "Groupe parlementaire d'exemple",
};

describe("seanceHref et demandeurs", () => {
  it("omet le rang inconnu de la séance", () => {
    expect(seanceHref({ id: "s1", seance: { uid: "SEANCE 1", rang: null } })).toBe(
      "/reunions/SEANCE%201?vote=s1",
    );
    expect(seanceHref({ id: "s1", seance: null })).toBeNull();
  });

  it("sépare des demandeurs enchaînés", () => {
    expect(
      demandeurs("Président du groupe « A » Présidente du groupe « B »\nLe Gouvernement"),
    ).toEqual(["Président du groupe « A »", "Présidente du groupe « B »", "Le Gouvernement"]);
  });
});

describe("ScrutinInfos", () => {
  it("lie la séance du vote", () => {
    const { getByText, getByRole } = renderScreen(
      <ScrutinInfos scrutin={scrutinDetailExemple({ seance: { uid: "SEANCE1", rang: 3 } })} />,
      { routes: { "/groupes": { data: [] } } },
    );
    expect(getByText("Séance publique")).toBeInTheDocument();
    expect(getByRole("link", { name: /voir ce vote dans la séance/ })).toHaveAttribute(
      "href",
      "/reunions/SEANCE1?vote=scrutin-exemple-1&rang=3",
    );
  });

  it("présente un scrutin du Sénat : session, demandeurs liés, mode important, sort brut", async () => {
    const { findByRole, getByText, getByRole, getAllByRole } = renderScreen(
      <ScrutinInfos
        scrutin={scrutinDetailExemple({
          chambre: "senat",
          session: "2025",
          legislature: null,
          demandeurTexte:
            "Président du groupe « Groupe parlementaire d'exemple »\nLa Conférence des présidents",
          typeVote: "mode_inconnu",
          importance: 4,
          natureVote: "nature_inconnue",
          sort: "sort d'exemple",
          tags: [],
          sourceUrl: "https://www.senat.fr/scrutin-exemple",
        })}
      />,
      { routes: { "/groupes": { data: [groupeExemple] } } },
    );
    expect(getByText("Session 2025-2026")).toBeInTheDocument();
    expect(getAllByRole("listitem")).toHaveLength(2);
    expect(await findByRole("link", { name: "Groupe parlementaire d'exemple" })).toHaveAttribute(
      "href",
      "/groupes/senat/gpa?session=2025",
    );
    expect(getByText("mode_inconnu")).toBeInTheDocument();
    expect(getByText("Important · calculé par CLAIR")).toBeInTheDocument();
    expect(getByText("sort d'exemple")).toBeInTheDocument();
    expect(getByRole("link", { name: /Voir sur senat\.fr/ })).toBeInTheDocument();
  });

  it("omet ce qui manque : période, demandeur, mode, objet, thématiques, source", () => {
    const { queryByText, queryByRole } = renderScreen(
      <ScrutinInfos
        scrutin={scrutinDetailExemple({
          chambre: "senat",
          session: null,
          legislature: null,
          demandeurTexte: null,
          typeVote: null,
          natureVote: null,
          tags: [],
          sourceUrl: null,
        })}
      />,
    );
    expect(queryByText("Vote demandé par")).toBeNull();
    expect(queryByText("Mode de scrutin")).toBeNull();
    expect(queryByText("Objet du vote")).toBeNull();
    expect(queryByText("Thématiques")).toBeNull();
    expect(queryByRole("link", { name: /Voir sur/ })).toBeNull();
  });

  it("lie un groupe de l'Assemblée sans législature connue, et un votant", async () => {
    const { findByRole } = renderScreen(
      <ScrutinInfos
        scrutin={scrutinDetailExemple({
          legislature: null,
          demandeurTexte: "Président du groupe « EXEMPLAIRE », Camille Exemple",
        })}
      />,
      {
        routes: {
          "/groupes": {
            data: [{ ...groupeExemple, nom: "EXEMPLAIRE", nomComplet: null, chambre: "assemblee" }],
          },
        },
      },
    );
    expect(await findByRole("link", { name: "EXEMPLAIRE" })).toHaveAttribute(
      "href",
      "/groupes/assemblee/gpa",
    );
    expect(await findByRole("link", { name: "Camille Exemple" })).toHaveAttribute(
      "href",
      "/deputes/camille-exemple",
    );
  });
});
