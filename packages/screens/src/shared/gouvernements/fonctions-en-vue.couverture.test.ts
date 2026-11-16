import { describe, expect, it } from "vitest";
import { type FonctionEnCours, fonctionsEnVue, titresDeLaFiche } from "./fonctions-en-vue.ts";

// Fonctions fictives.
const f = (partiel: Partial<FonctionEnCours>): FonctionEnCours => ({
  typeOrgane: "COMPER",
  institution: null,
  qualite: "Président",
  dateFin: null,
  ...partiel,
});

describe("fonctionsEnVue", () => {
  it("écarte une fonction sans qualité ou d'âge", () => {
    expect(
      fonctionsEnVue([
        f({ qualite: null }),
        f({ qualite: "  " }),
        f({ qualite: "Président d'âge" }),
      ]),
    ).toEqual([]);
  });

  it("garde la qualité seule quand la commission n'a pas de nom", () => {
    expect(fonctionsEnVue([f({ qualite: "Rapporteur général" })])).toEqual([
      { libelle: "Rapporteur général", depuis: null },
    ]);
  });

  it("nomme une délégation et un groupe", () => {
    expect(
      fonctionsEnVue([
        f({ typeOrgane: "CNPE", institution: "Délégation aux exemples" }),
        f({ typeOrgane: "GP", institution: "Groupe Exemple" }),
      ]).map((x) => x.libelle),
    ).toEqual(["Président de la délégation aux exemples", "Président du groupe Exemple"]);
  });

  it("nomme un autre organe avec son article", () => {
    expect(
      fonctionsEnVue([f({ typeOrgane: "COMMISSION", institution: "Office des exemples" })])[0]
        ?.libelle,
    ).toBe("Président de l’office des exemples");
  });

  it("écarte une présidence de groupe sans institution", () => {
    expect(fonctionsEnVue([f({ typeOrgane: "GP", institution: null })])).toEqual([]);
  });

  it("garde la date la plus ancienne d'une fonction en double", () => {
    const commission = { nom: "Commission des exemples" };
    expect(
      fonctionsEnVue([
        f({ commission, dateDebut: null }),
        f({ commission, dateDebut: "2024-10-01T00:00:00.000Z" }),
        f({ commission, dateDebut: "2022-07-01T00:00:00.000Z" }),
        f({ commission, dateDebut: "2023-07-01T00:00:00.000Z" }),
      ]),
    ).toEqual([{ libelle: "Président de la commission des exemples", depuis: "2022-07-01" }]);
  });

  it("remonte les périodes qui s'enchaînent d'une même fonction", () => {
    const bureau = (dateDebut: string, dateFin: string | null): FonctionEnCours =>
      f({ typeOrgane: "BUREAU", qualite: "Président du Sénat", dateDebut, dateFin });
    expect(
      fonctionsEnVue([
        bureau("2014-10-01", "2017-10-01"),
        bureau("2017-10-02", "2020-10-01"),
        bureau("2020-10-02", null),
      ]),
    ).toEqual([{ libelle: "Président du Sénat", depuis: "2014-10-01" }]);
  });
});

describe("titresDeLaFiche", () => {
  it("met le poste au Gouvernement d'abord, avec un lien s'il a un gouvernement", () => {
    expect(
      titresDeLaFiche({ titre: "Ministre · Exemples", depuis: "2025-01-01", gouvernement: null }, [
        { libelle: "Président du groupe Exemple", depuis: null },
      ]),
    ).toEqual([
      { titre: "Ministre · Exemples", depuis: "2025-01-01", lien: null },
      { titre: "Président du groupe Exemple", depuis: null },
    ]);
    expect(
      titresDeLaFiche(
        {
          titre: "Ministre · Exemples",
          depuis: "2025-01-01",
          gouvernement: { slug: "gouv-exemple", nom: "Exemple" },
        },
        [],
      )[0]?.lien,
    ).toEqual({ href: "/gouvernements/gouv-exemple", libelle: "Gouvernement Exemple" });
  });

  it("renvoie une liste vide sans poste ni fonction", () => {
    expect(titresDeLaFiche(null, [])).toEqual([]);
  });
});
