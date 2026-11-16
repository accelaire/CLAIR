import { describe, expect, it } from "vitest";
import { nomsDuGroupe, segmenterDemandeur } from "./liens-demandeurs.ts";
import { demandeurs } from "./ScrutinInfos.tsx";

// Noms de groupe et d'élu FICTIFS.
const cibles = [
  { nom: "Union fictive", href: "/groupes/assemblee/uf" },
  { nom: "Union fictive - Nouvel Exemple", href: "/groupes/assemblee/uf-ne" },
  { nom: "Camille Exemple", href: "/deputes/camille-exemple" },
  { nom: "UF", href: "/groupes/assemblee/sigle" },
];

describe("segmenterDemandeur", () => {
  it("lie le nom le plus long d'un groupe, sans tenir compte des accents ni de la casse", () => {
    expect(
      segmenterDemandeur('Président du groupe "Union Fictive – Nouvel Éxemple"', cibles),
    ).toEqual([
      { texte: 'Président du groupe "' },
      { texte: "Union Fictive – Nouvel Éxemple", href: "/groupes/assemblee/uf-ne" },
      { texte: '"' },
    ]);
  });

  it("lie un parlementaire et laisse le reste en texte", () => {
    expect(
      segmenterDemandeur("Mme Camille Exemple et les membres du groupe Union fictive", cibles),
    ).toEqual([
      { texte: "Mme " },
      { texte: "Camille Exemple", href: "/deputes/camille-exemple" },
      { texte: " et les membres du groupe " },
      { texte: "Union fictive", href: "/groupes/assemblee/uf" },
    ]);
  });

  it("ignore un nom trop court ou pris au milieu d'un mot", () => {
    expect(segmenterDemandeur("Présidente de séance, UF, Reunion fictive", cibles)).toEqual([
      { texte: "Présidente de séance, UF, Reunion fictive" },
    ]);
  });
});

describe("demandeurs", () => {
  it("sépare des demandeurs enchaînés, même sans espace après le guillemet", () => {
    expect(
      demandeurs('Présidente du groupe "Union fictive"Président du groupe "Autre exemple"'),
    ).toEqual(['Présidente du groupe "Union fictive"', 'Président du groupe "Autre exemple"']);
  });
});

describe("nomsDuGroupe", () => {
  it("accepte le nom complet avec ou sans « Groupe »", () => {
    expect(nomsDuGroupe({ nom: "UFE", nomComplet: "Groupe du Rassemblement fictif" })).toEqual([
      "UFE",
      "Groupe du Rassemblement fictif",
      "Rassemblement fictif",
    ]);
  });
});
