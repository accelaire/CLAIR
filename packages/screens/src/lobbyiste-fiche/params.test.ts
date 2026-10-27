import { buildHref } from "@clair/ui";
import { describe, expect, it } from "vitest";
import { dansLaPeriode, lobbyisteFicheParamsOf, parseLobbyisteFicheParams } from "./params.ts";

describe("paramètres de la fiche d'un représentant d'intérêts", () => {
  it("lit la période et ignore une date mal formée", () => {
    expect(parseLobbyisteFicheParams({ dateFrom: "2026-01-01", dateTo: "demain" })).toEqual({
      dateFrom: "2026-01-01",
      dateTo: "",
    });
  });

  it("réécrit l'URL sans les bornes vides", () => {
    expect(
      buildHref("/lobbying/x", lobbyisteFicheParamsOf({ dateFrom: "", dateTo: "2026-02-01" })),
    ).toBe("/lobbying/x?dateTo=2026-02-01");
  });

  it("filtre les actions par jour, bornes incluses, et garde celles sans date", () => {
    const periode = { dateFrom: "2026-01-01", dateTo: "2026-01-31" };
    expect(dansLaPeriode("2026-01-31T00:00:00.000Z", periode)).toBe(true);
    expect(dansLaPeriode("2026-02-01T00:00:00.000Z", periode)).toBe(false);
    expect(dansLaPeriode("2025-12-31T00:00:00.000Z", periode)).toBe(false);
    expect(dansLaPeriode(null, periode)).toBe(true);
  });
});
