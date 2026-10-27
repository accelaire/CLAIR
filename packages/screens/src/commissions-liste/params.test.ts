import { buildHref } from "@clair/ui";
import { describe, expect, it } from "vitest";
import {
  aDesFiltres,
  commissionsListeParamsOf,
  commissionsQueryOf,
  estVueParDefaut,
  parseCommissionsListeParams,
} from "./params.ts";

describe("paramètres de la liste des commissions", () => {
  it("lit l'URL et ignore les valeurs inconnues", () => {
    expect(
      parseCommissionsListeParams({
        search: " jardins ",
        chambre: "senat",
        type: "enquete",
        historique: "1",
      }),
    ).toEqual({ search: "jardins", chambre: "senat", type: "enquete", historique: true });
    expect(
      parseCommissionsListeParams({ chambre: "x", type: "inconnu", historique: "oui" }),
    ).toEqual({ search: "", chambre: "", type: "", historique: false });
  });

  it("réécrit l'URL sans les valeurs par défaut et demande les actives par défaut", () => {
    const params = parseCommissionsListeParams({ type: "permanente" });
    expect(buildHref("/commissions", commissionsListeParamsOf(params))).toBe(
      "/commissions?type=permanente",
    );
    expect(
      buildHref("/commissions", commissionsListeParamsOf({ ...params, historique: true })),
    ).toBe("/commissions?type=permanente&historique=1");
    expect(commissionsQueryOf(params)).toMatchObject({ actif: "true", limit: 500 });
    expect(commissionsQueryOf({ ...params, historique: true }).actif).toBeNull();
    expect(estVueParDefaut(parseCommissionsListeParams({ search: "x" }))).toBe(true);
    expect(estVueParDefaut(params)).toBe(false);
    expect(aDesFiltres(parseCommissionsListeParams({}))).toBe(false);
  });
});
