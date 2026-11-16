import { describe, expect, it } from "vitest";
import { parseScrutinsListeParams, scrutinsListeParamsOf, scrutinsQueryOf } from "./params.ts";

describe("paramètres de la liste des scrutins", () => {
  it("lit l'URL et ignore les valeurs inconnues", () => {
    expect(
      parseScrutinsListeParams({
        search: " budget ",
        chambre: "senat",
        type: "inconnu",
        nature: "amendement",
        tag: "sante",
        censure: "alinea3",
        dateFrom: "2026-01-01",
        dateTo: "pas-une-date",
        page: "3",
      }),
    ).toEqual({
      search: "budget",
      chambre: "senat",
      type: "",
      nature: "amendement",
      tag: "sante",
      censure: "alinea3",
      dateFrom: "2026-01-01",
      dateTo: "",
      page: 3,
    });
  });

  it("revient en page 1 pour une page invalide", () => {
    expect(parseScrutinsListeParams({ page: "-2" }).page).toBe(1);
    expect(parseScrutinsListeParams({ page: "abc" }).page).toBe(1);
  });

  it("omet la page 1 de l'URL et l'ajoute à la requête", () => {
    const params = parseScrutinsListeParams({ chambre: "assemblee" });
    expect(scrutinsListeParamsOf(params).page).toBeNull();
    expect(scrutinsQueryOf(params)).toEqual({ chambre: "assemblee", page: "1", limit: "20" });
  });

  it("lit le filtre des motions de censure de apps/web et le transmet à l'API", () => {
    expect(parseScrutinsListeParams({ censure: "toutes" }).censure).toBe("toutes");
    expect(parseScrutinsListeParams({ censure: "alinea2" }).censure).toBe("alinea2");
    expect(parseScrutinsListeParams({ censure: "alinea4" }).censure).toBe("");
    expect(scrutinsQueryOf(parseScrutinsListeParams({ censure: "alinea3" }))).toEqual({
      censure: "alinea3",
      page: "1",
      limit: "20",
    });
  });

  it("relit ce qu'il écrit", () => {
    const params = parseScrutinsListeParams({ tag: "europe", page: "2", type: "solennel" });
    const ecrit = Object.fromEntries(
      Object.entries(scrutinsListeParamsOf(params))
        .filter(([, value]) => value !== null && value !== "")
        .map(([key, value]) => [key, String(value)]),
    );
    expect(parseScrutinsListeParams(ecrit)).toEqual(params);
  });
});
