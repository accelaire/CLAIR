import { describe, expect, it } from "vitest";
import {
  heureDe,
  jourCourt,
  jourLong,
  libelleDeSeance,
  lienSur,
  pluriel,
  pointsDeLOrdreDuJour,
  urlDuCompteRendu,
} from "./reunions.ts";

describe("pointsDeLOrdreDuJour", () => {
  it("renvoie une liste vide sans ordre du jour", () => {
    expect(pointsDeLOrdreDuJour(null, undefined)).toEqual([]);
    expect(pointsDeLOrdreDuJour("", "")).toEqual([]);
  });

  it("découpe le résumé sur les barres verticales et retire la ponctuation de liste", () => {
    expect(pointsDeLOrdreDuJour("- Audition du ministre ; | – Examen du texte,| ", null)).toEqual([
      "Audition du ministre",
      "Examen du texte",
    ]);
  });

  it("préfère l'ordre du jour complet, découpé par ligne", () => {
    expect(pointsDeLOrdreDuJour("Résumé coupé", "— Premier point\n\nSecond point;")).toEqual([
      "Premier point",
      "Second point",
    ]);
  });
});

describe("urlDuCompteRendu", () => {
  it("renvoie null sans référence ou pour une forme inconnue", () => {
    expect(urlDuCompteRendu(null)).toBeNull();
    expect(urlDuCompteRendu("")).toBeNull();
    expect(urlDuCompteRendu("XYZ123")).toBeNull();
  });

  it("garde une URL directe", () => {
    expect(urlDuCompteRendu("https://www.senat.fr/compte-rendu")).toBe(
      "https://www.senat.fr/compte-rendu",
    );
  });

  it("construit l'adresse d'une commission de l'Assemblée", () => {
    expect(urlDuCompteRendu("CRCANR5L17S2026O1N001")).toBe(
      "https://www.assemblee-nationale.fr/dyn/docs/CRCANR5L17S2026O1N001.html",
    );
  });

  it("construit l'adresse d'une séance de l'Assemblée avec sa législature", () => {
    expect(urlDuCompteRendu("CRSANR5L16S2023O1N100")).toBe(
      "https://www.assemblee-nationale.fr/dyn/16/comptes-rendus/seance/CRSANR5L16S2023O1N100",
    );
  });

  it("prend la XVIIe législature quand la référence n'en porte pas", () => {
    expect(urlDuCompteRendu("CRSANR5X")).toBe(
      "https://www.assemblee-nationale.fr/dyn/17/comptes-rendus/seance/CRSANR5X",
    );
  });

  it("construit l'adresse d'une séance du Sénat à partir de sa date", () => {
    expect(urlDuCompteRendu("CRSSNR20260115")).toBe(
      "https://www.senat.fr/cra/s20260115/s20260115_mono.html",
    );
    expect(urlDuCompteRendu("CRSSNRsansdate")).toBeNull();
  });
});

describe("lienSur", () => {
  it("ne garde que les adresses http(s)", () => {
    expect(lienSur("https://exemple.fr")).toBe("https://exemple.fr");
    expect(lienSur("http://exemple.fr")).toBe("http://exemple.fr");
    expect(lienSur("javascript:alert(1)")).toBeNull();
    expect(lienSur(null)).toBeNull();
    expect(lienSur(undefined)).toBeNull();
  });
});

describe("libelleDeSeance", () => {
  it("renvoie une chaîne vide pour une date invalide", () => {
    expect(libelleDeSeance("pas une date")).toBe("");
  });

  it("n'annonce pas d'heure à minuit", () => {
    expect(libelleDeSeance("2026-06-26T00:00:00Z")).toBe("vendredi 26 juin 2026");
  });

  it("accorde « heure » au singulier et au pluriel", () => {
    expect(libelleDeSeance("2026-06-26T01:00:00Z")).toBe("vendredi 26 juin 2026, 1 heure");
    expect(libelleDeSeance("2026-06-26T09:00:00Z")).toBe("vendredi 26 juin 2026, 9 heures");
  });

  it("écrit les minutes sur deux chiffres", () => {
    expect(libelleDeSeance("2026-06-26T14:05:00Z")).toBe("vendredi 26 juin 2026, 14 h 05");
  });
});

describe("formats de date", () => {
  it("lit les dates en heure de Paris", () => {
    expect(heureDe("2026-03-03T08:30:00Z")).toBe("09:30");
    expect(jourLong("2026-03-03T08:30:00Z")).toBe("mardi 3 mars 2026");
    expect(jourCourt("2026-03-03T08:30:00Z")).toBe("3 mars 2026");
  });
});

describe("pluriel", () => {
  it("accorde au singulier et au pluriel, avec une forme plurielle propre", () => {
    expect(pluriel(1, "réunion")).toBe("1 réunion");
    expect(pluriel(2, "réunion")).toBe("2 réunions");
    expect(pluriel(3, "travail", "travaux")).toBe("3 travaux");
  });
});
