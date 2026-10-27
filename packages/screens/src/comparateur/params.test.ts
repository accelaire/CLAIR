import { describe, expect, it } from "vitest";
import { comparateurParamsOf, compareQueryOf, parseComparateurParams } from "./params.ts";

describe("parseComparateurParams", () => {
  it("lit les slugs séparés par des virgules, sans doublon, quatre au plus", () => {
    expect(parseComparateurParams({ slugs: "a,b,a,c,d,e", divergents: "1" })).toEqual({
      slugs: ["a", "b", "c", "d"],
      divergents: true,
    });
    expect(parseComparateurParams({})).toEqual({ slugs: [], divergents: false });
  });
});

describe("comparateurParamsOf", () => {
  it("écrit l'URL et relit la même chose", () => {
    const filtres = { slugs: ["a", "b"], divergents: true };
    expect(comparateurParamsOf(filtres)).toEqual({ slugs: "a,b", divergents: "1" });
    expect(parseComparateurParams(comparateurParamsOf(filtres))).toEqual(filtres);
    expect(compareQueryOf(filtres)).toEqual({ slugs: "a,b" });
  });
});
