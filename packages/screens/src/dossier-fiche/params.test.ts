import { buildHref } from "@clair/ui";
import { describe, expect, it } from "vitest";
import { dossierFicheParamsOf, filtreAmendementActif, parseDossierFicheParams } from "./params.ts";

describe("paramètres de la fiche d'un dossier", () => {
  it("lit l'onglet et les filtres, et ignore un onglet inconnu", () => {
    expect(
      parseDossierFicheParams({ tab: "amendements", groupe: "exemple", voted: "true", page: "2" }),
    ).toEqual({
      tab: "amendements",
      groupe: "exemple",
      sort: "",
      amendement: "",
      nature: "",
      voted: true,
      page: 2,
    });
    expect(parseDossierFicheParams({ tab: "inconnu" }).tab).toBeNull();
  });

  it("réécrit l'URL sans les valeurs par défaut", () => {
    const params = parseDossierFicheParams({ tab: "scrutins", nature: "ensemble" });
    expect(buildHref("/dossiers/DLEXEMPLE1", dossierFicheParamsOf(params))).toBe(
      "/dossiers/DLEXEMPLE1?tab=scrutins&nature=ensemble",
    );
    expect(filtreAmendementActif(params)).toBe(false);
    expect(filtreAmendementActif({ ...params, sort: "Adopté" })).toBe(true);
  });
});
