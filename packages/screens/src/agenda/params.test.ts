import { buildHref } from "@clair/ui";
import { describe, expect, it } from "vitest";
import {
  agendaParamsOf,
  agendaQueryOf,
  decalerMois,
  jourChoisi,
  jourParis,
  joursDansLeMois,
  moisAffiche,
  parseAgendaParams,
} from "./params.ts";

describe("paramètres de l'agenda", () => {
  it("lit l'URL et ignore les valeurs inconnues", () => {
    expect(
      parseAgendaParams({ date: "2026-03-03", mois: "2026-13", chambre: "senat", type: "seance" }),
    ).toEqual({ date: "2026-03-03", mois: "", chambre: "senat", type: "seance" });
    expect(parseAgendaParams({ date: "2026-3-3", type: "x", chambre: "y" })).toEqual({
      date: "",
      mois: "",
      chambre: "",
      type: "",
    });
  });

  it("choisit le mois et le jour affichés", () => {
    const aujourdhui = "2026-10-26";
    expect(moisAffiche(parseAgendaParams({}), aujourdhui)).toBe("2026-10");
    expect(jourChoisi(parseAgendaParams({}), aujourdhui)).toBe(aujourdhui);
    expect(moisAffiche(parseAgendaParams({ mois: "2026-02" }), aujourdhui)).toBe("2026-02");
    expect(jourChoisi(parseAgendaParams({ mois: "2026-02" }), aujourdhui)).toBe("");
    expect(moisAffiche(parseAgendaParams({ date: "2025-12-31" }), aujourdhui)).toBe("2025-12");
  });

  it("demande tout le mois à l'API", () => {
    expect(agendaQueryOf(parseAgendaParams({ mois: "2028-02", chambre: "senat" }), "x")).toEqual({
      dateFrom: "2028-02-01",
      dateTo: "2028-02-29",
      chambre: "senat",
      type: "",
      limit: 1000,
    });
  });

  it("calcule les mois voisins et le jour de Paris", () => {
    expect(decalerMois("2026-12", 1)).toBe("2027-01");
    expect(decalerMois("2026-01", -1)).toBe("2025-12");
    expect(joursDansLeMois("2026-04")).toBe(30);
    expect(jourParis(new Date("2026-03-03T23:30:00Z"))).toBe("2026-03-04");
  });

  it("réécrit l'URL sans mois quand un jour est choisi", () => {
    const params = parseAgendaParams({ date: "2026-03-03", mois: "2026-03", type: "commission" });
    expect(buildHref("/agenda", agendaParamsOf(params))).toBe(
      "/agenda?date=2026-03-03&type=commission",
    );
    expect(buildHref("/agenda", agendaParamsOf({ ...params, date: "" }))).toBe(
      "/agenda?mois=2026-03&type=commission",
    );
  });
});
