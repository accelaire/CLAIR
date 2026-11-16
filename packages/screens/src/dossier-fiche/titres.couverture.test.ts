import { describe, expect, it } from "vitest";
import { dossierFicheParamsOf, parseDossierFicheParams } from "./params.ts";
import { titreCourtLisible, titreDossier } from "./titres.ts";

describe("titres d'un dossier : cas limites", () => {
  it("garde un titre court lisible", () => {
    expect(titreCourtLisible({ titreCourt: "Jardins partagés", uid: "DLEXEMPLE1" })).toBe(
      "Jardins partagés",
    );
    expect(titreCourtLisible({ titreCourt: "mots_lies", uid: "DLEXEMPLE1" })).toBeNull();
  });

  it("garde un titre qui commence par une majuscule, ou sans procédure", () => {
    expect(titreDossier({ titre: "Loi d'exemple", procedureLibelle: "Projet de loi" })).toBe(
      "Loi d'exemple",
    );
    expect(titreDossier({ titre: "relative à l'exemple", procedureLibelle: null })).toBe(
      "relative à l'exemple",
    );
  });
});

describe("paramètres de la fiche d'un dossier : sortie", () => {
  it("écrit le filtre « votes publics » et la page au-delà de la première", () => {
    const params = parseDossierFicheParams({ voted: "true", page: "3" });
    expect(dossierFicheParamsOf(params)).toMatchObject({ voted: "true", page: 3 });
  });
});
