import { buildHref } from "@clair/ui";
import { describe, expect, it } from "vitest";
import { aDesFiltres, dossiersListeParamsOf, parseDossiersListeParams } from "./params.ts";

describe("paramètres de la liste des dossiers", () => {
  it("lit les filtres de l'URL et ignore les valeurs inconnues", () => {
    const params = parseDossiersListeParams({
      search: " narcotrafic ",
      etat: "promulgue",
      chambre: "senat",
      procedureLibelle: "Proposition de loi ordinaire",
      dateFrom: "2025-01-01",
      dateTo: "pas-une-date",
      page: "3",
    });
    expect(params).toEqual({
      search: "narcotrafic",
      etat: "promulgue",
      chambre: "senat",
      procedureCode: "",
      procedureLibelle: "Proposition de loi ordinaire",
      dateFrom: "2025-01-01",
      dateTo: "",
      page: 3,
    });
    expect(parseDossiersListeParams({ etat: "inconnu", chambre: "x", page: "0" })).toMatchObject({
      etat: "",
      chambre: "",
      page: 1,
    });
  });

  it("réécrit l'URL sans les valeurs par défaut", () => {
    const params = parseDossiersListeParams({ etat: "en_cours", page: "1" });
    expect(buildHref("/dossiers", dossiersListeParamsOf(params))).toBe("/dossiers?etat=en_cours");
    expect(buildHref("/dossiers", dossiersListeParamsOf({ ...params, page: 2 }))).toBe(
      "/dossiers?etat=en_cours&page=2",
    );
    expect(aDesFiltres(params)).toBe(true);
    expect(aDesFiltres(parseDossiersListeParams({ page: "4" }))).toBe(false);
  });
});
