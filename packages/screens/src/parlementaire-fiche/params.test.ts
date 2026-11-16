import { describe, expect, it } from "vitest";
import {
  interventionsQueryOf,
  parlementaireFicheParamsOf,
  parseParlementaireFicheParams,
  votesQueryOf,
} from "./params.ts";

describe("parseParlementaireFicheParams", () => {
  it("ouvre l'onglet des votes par défaut", () => {
    expect(parseParlementaireFicheParams({})).toEqual({
      onglet: "votes",
      page: 1,
      dateFrom: "",
      dateTo: "",
      dissidents: false,
      votesPublics: false,
      type: "",
      chambre: "",
    });
  });

  it("ignore un onglet ou une date invalides", () => {
    const filtres = parseParlementaireFicheParams({ onglet: "x", dateFrom: "hier", page: "0" });
    expect(filtres.onglet).toBe("votes");
    expect(filtres.dateFrom).toBe("");
    expect(filtres.page).toBe(1);
  });
});

describe("parlementaireFicheParamsOf", () => {
  it("écrit l'URL sans les valeurs par défaut, et relit la même chose", () => {
    const filtres = {
      onglet: "amendements" as const,
      page: 3,
      dateFrom: "2025-01-01",
      dateTo: "2025-12-31",
      dissidents: false,
      votesPublics: true,
      type: "" as const,
      chambre: "senat" as const,
    };
    const params = parlementaireFicheParamsOf(filtres);
    expect(params).toEqual({
      onglet: "amendements",
      page: "3",
      dateFrom: "2025-01-01",
      dateTo: "2025-12-31",
      votesPublics: "1",
      chambre: "senat",
    });
    expect(parseParlementaireFicheParams(params)).toEqual(filtres);
    expect(parlementaireFicheParamsOf(parseParlementaireFicheParams({}))).toEqual({});
  });
});

describe("votesQueryOf", () => {
  it("traduit les filtres pour l'API", () => {
    expect(votesQueryOf(parseParlementaireFicheParams({ dissidents: "1", page: "2" }))).toEqual({
      page: "2",
      limit: "20",
      dissidentOnly: "true",
    });
  });
});

describe("interventionsQueryOf", () => {
  it("transmet la nature et la chambre à l'API, et ignore une nature inconnue", () => {
    expect(
      interventionsQueryOf(
        parseParlementaireFicheParams({
          type: "question",
          chambre: "senat",
          dateFrom: "2025-01-01",
        }),
      ),
    ).toEqual({
      page: "1",
      limit: "10",
      dateFrom: "2025-01-01",
      chambre: "senat",
      type: "question",
    });
    expect(parseParlementaireFicheParams({ type: "chahut", chambre: "x" })).toMatchObject({
      type: "",
      chambre: "",
    });
  });
});
