import { describe, expect, it } from "vitest";
import {
  fonctionsEnVue as enVue,
  type FonctionEnCours,
  titresDeLaFiche,
} from "./fonctions-en-vue.ts";

const fonctionsEnVue = (f: FonctionEnCours[]) => enVue(f).map((x) => x.libelle);

const f = (
  typeOrgane: string,
  qualite: string,
  institution: string | null,
  dateFin: string | null = null,
): FonctionEnCours => ({ typeOrgane, qualite, institution, dateFin });

describe("fonctionsEnVue", () => {
  it("met en avant la présidence du Sénat, pas les fonctions passées", () => {
    expect(
      fonctionsEnVue([
        f("BUREAU", "Président du Sénat", "Bureau du Sénat"),
        f("BUREAU", "Vice-président du Sénat", "Bureau du Sénat", "2001-10-02"),
        f("COMMISSION", "Président", "Commission des affaires économiques", "2004-04-30"),
      ]),
    ).toEqual(["Président du Sénat"]);
  });

  it("nomme la commission présidée, à partir de la commission liée", () => {
    expect(
      fonctionsEnVue([
        { ...f("COMMISSION", "Présidente", null), commission: { nom: "Commission des finances" } },
        f("COMMISSION", "Rapporteure générale", "Commission des finances"),
        f("COMMISSION", "Vice-Président", "Commission des lois"),
        f("COMMISSION", "Membre", "Commission des lois"),
      ]),
    ).toEqual([
      "Présidente de la commission des finances",
      "Rapporteure générale de la commission des finances",
    ]);
  });

  it("nomme le groupe présidé", () => {
    expect(
      fonctionsEnVue([
        f("GP", "Président", "Groupe Les Républicains"),
        f("GP", "Vice-Président", "Groupe Les Républicains"),
      ]),
    ).toEqual(["Président du groupe Les Républicains"]);
  });

  it("n'affiche pas les présidences tenues d'office", () => {
    expect(
      fonctionsEnVue([
        f("BUREAU", "Président de l'Assemblée nationale", "Bureau de l'Assemblée"),
        f("COMNL", "Président", "Comité d'évaluation et de contrôle des politiques publiques"),
        f("API", "Président", "Section française de l'Assemblée parlementaire de la francophonie"),
        f("COMPER", "Présidente", "Commission des lois"),
      ]),
    ).toEqual(["Président de l'Assemblée nationale", "Présidente de la commission des lois"]);
  });

  it("écarte les fonctions d'âge", () => {
    expect(
      fonctionsEnVue([
        f("BUREAU", "Secrétaire d'âge de l'Assemblée nationale", "Bureau de l'Assemblée"),
      ]),
    ).toEqual([]);
  });

  it("classe le bureau avant les commissions et les groupes", () => {
    expect(
      fonctionsEnVue([
        f("GP", "Président", "Groupe Exemple"),
        f("COMMISSION", "Président", "Commission des lois"),
        f("BUREAU", "Questeur du Sénat", "Bureau du Sénat"),
      ]),
    ).toEqual([
      "Questeur du Sénat",
      "Président de la commission des lois",
      "Président du groupe Exemple",
    ]);
  });
});

describe("fonctionsEnVue : date de début", () => {
  const b = (dateDebut: string, dateFin: string | null): FonctionEnCours => ({
    typeOrgane: "BUREAU",
    qualite: "Président du Sénat",
    institution: "Bureau du Sénat",
    dateDebut,
    dateFin,
  });

  it("remonte les périodes qui s'enchaînent, pas au-delà d'une interruption", () => {
    expect(
      enVue([
        b("2008-10-01", "2011-09-30"),
        b("2014-10-01", "2023-10-01"),
        b("2023-10-02", "2026-09-30"),
        b("2026-10-01", null),
      ]),
    ).toEqual([{ libelle: "Président du Sénat", depuis: "2014-10-01" }]);
  });

  it("rend le jour civil d'un horodatage", () => {
    expect(enVue([b("2024-07-18T00:00:00.000Z", null)])[0]?.depuis).toBe("2024-07-18");
  });

  it("rend null sans date de début", () => {
    expect(enVue([f("BUREAU", "Questeur du Sénat", "Bureau du Sénat")])).toEqual([
      { libelle: "Questeur du Sénat", depuis: null },
    ]);
  });
});

describe("titresDeLaFiche", () => {
  it("met le poste au Gouvernement en tête, lié à la page du gouvernement", () => {
    expect(
      titresDeLaFiche(
        {
          titre: "Premier ministre",
          depuis: "2025-09-10",
          gouvernement: { slug: "exemple-ii", nom: "Exemple II" },
        },
        [{ libelle: "Président du groupe Exemple", depuis: null }],
      ),
    ).toEqual([
      {
        titre: "Premier ministre",
        depuis: "2025-09-10",
        lien: { href: "/gouvernements/exemple-ii", libelle: "Gouvernement Exemple II" },
      },
      { titre: "Président du groupe Exemple", depuis: null },
    ]);
  });
});
