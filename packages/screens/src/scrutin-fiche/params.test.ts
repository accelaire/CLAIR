import { describe, expect, it } from "vitest";
import { scrutinHref } from "../shared/scrutins.ts";
import { parseNumero, parseScrutinFicheParams, scrutinFicheParamsOf } from "./params.ts";

describe("paramètres de la fiche d'un scrutin", () => {
  it("vaut l'Assemblée par défaut, comme l'API", () => {
    const params = parseScrutinFicheParams({});
    expect(params.chambre).toBe("assemblee");
    expect(scrutinFicheParamsOf(params)).toMatchObject({ chambre: "assemblee", page: null });
  });

  it("lit l'onglet et les filtres, ignore les valeurs inconnues", () => {
    expect(
      parseScrutinFicheParams({
        chambre: "senat",
        session: "2025",
        onglet: "vote",
        position: "inconnue",
        nature: "toutes",
        ordre: "desc",
        page: "2",
      }),
    ).toMatchObject({
      chambre: "senat",
      session: "2025",
      onglet: "vote",
      position: "",
      nature: "toutes",
      ordre: "desc",
      page: 2,
    });
  });

  it("n'accepte qu'un numéro entier positif", () => {
    expect(parseNumero("54")).toBe(54);
    expect(parseNumero("0")).toBeNull();
    expect(parseNumero("54abc")).toBeNull();
  });

  it("construit une adresse non ambiguë (chambre et session)", () => {
    expect(scrutinHref({ numero: 54, chambre: "senat", session: "2025" })).toBe(
      "/scrutins/54?chambre=senat&session=2025",
    );
    expect(scrutinHref({ numero: 4000, chambre: null, session: "17" })).toBe(
      "/scrutins/4000?chambre=assemblee&session=17",
    );
  });
});
