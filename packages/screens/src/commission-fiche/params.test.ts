import { buildHref } from "@clair/ui";
import { describe, expect, it } from "vitest";
import {
  commissionFicheParamsOf,
  ongletEffectif,
  ongletsDisponibles,
  parseCommissionFicheParams,
} from "./params.ts";

describe("paramètres de la fiche d'une commission", () => {
  it("lit l'URL et ignore les valeurs inconnues", () => {
    expect(
      parseCommissionFicheParams({
        tab: "dossiers",
        role: "fond",
        etat: "promulgue",
        dateFrom: "2025-01-01",
        dateTo: "hier",
        page: "2",
      }),
    ).toEqual({
      tab: "dossiers",
      role: "fond",
      etat: "promulgue",
      dateFrom: "2025-01-01",
      dateTo: "",
      page: 2,
    });
    expect(parseCommissionFicheParams({ tab: "x", role: "y", etat: "z", page: "-1" })).toEqual({
      tab: null,
      role: "",
      etat: "",
      dateFrom: "",
      dateTo: "",
      page: 1,
    });
  });

  it("réécrit l'URL sans les valeurs par défaut", () => {
    const params = parseCommissionFicheParams({ tab: "historique" });
    expect(buildHref("/commissions/x", commissionFicheParamsOf({ ...params, page: 3 }))).toBe(
      "/commissions/x?tab=historique&page=3",
    );
  });

  it("choisit un onglet disponible selon le type de l'organe", () => {
    const hemicycle = ongletsDisponibles({ type: "hemicycle", nbDossiers: 4 });
    expect(hemicycle).toEqual(["agenda", "historique"]);
    expect(ongletEffectif("membres", hemicycle)).toBe("historique");
    const permanente = ongletsDisponibles({ type: "permanente", nbDossiers: 0 });
    expect(permanente).toEqual(["membres", "agenda", "historique"]);
    expect(ongletEffectif(null, permanente)).toBe("membres");
    expect(ongletEffectif("historique", permanente)).toBe("historique");
  });
});
