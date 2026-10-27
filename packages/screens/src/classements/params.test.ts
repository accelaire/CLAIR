import { buildHref } from "@clair/ui";
import { describe, expect, it } from "vitest";
import { classementsParamsOf, pageEffective, parseClassementsParams } from "./params.ts";

describe("paramètres des classements", () => {
  it("lit l'URL avec les valeurs par défaut de apps/web", () => {
    expect(parseClassementsParams({})).toEqual({
      tab: "parlementaires",
      chambre: "",
      sort: "presence",
      order: "desc",
      periode: "mandat",
      groupe: "",
      page: null,
      highlight: "",
      rank: null,
      groupeSort: "presence",
    });
    expect(
      parseClassementsParams({
        tab: "groupes",
        sort: "inconnu",
        order: "asc",
        page: "-2",
        groupeSort: "membres",
      }),
    ).toMatchObject({
      tab: "groupes",
      sort: "presence",
      order: "asc",
      page: null,
      groupeSort: "membres",
    });
  });

  it("réécrit l'URL sans les valeurs par défaut", () => {
    const params = parseClassementsParams({ chambre: "senat", sort: "loyaute", page: "2" });
    expect(buildHref("/classements", classementsParamsOf(params))).toBe(
      "/classements?chambre=senat&sort=loyaute&page=2",
    );
    expect(
      buildHref(
        "/classements",
        classementsParamsOf(parseClassementsParams({ tab: "parlementaires" })),
      ),
    ).toBe("/classements");
  });

  it("déduit la page du rang mis en avant", () => {
    expect(pageEffective(parseClassementsParams({}), 120)).toBe(3);
    expect(pageEffective(parseClassementsParams({ page: "2" }), 120)).toBe(2);
    expect(pageEffective(parseClassementsParams({}), null)).toBe(1);
  });
});
