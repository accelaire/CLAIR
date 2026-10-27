import { buildHref } from "@clair/ui";
import { describe, expect, it } from "vitest";
import { pageDuDebat, pageDuRang, parseReunionParams, reunionParamsOf } from "./params.ts";

describe("paramètres de la page d'une réunion", () => {
  it("lit le vote suivi et la page du débat", () => {
    expect(parseReunionParams({ vote: "abc", rang: "412", debat: "2" })).toEqual({
      vote: "abc",
      rang: 412,
      debat: 2,
    });
    expect(parseReunionParams({ rang: "-3", debat: "0" })).toEqual({
      vote: "",
      rang: null,
      debat: null,
    });
  });

  it("déduit la page du débat du rang suivi", () => {
    expect(pageDuRang(1)).toBe(1);
    expect(pageDuRang(200)).toBe(1);
    expect(pageDuRang(201)).toBe(2);
    expect(pageDuDebat(parseReunionParams({ rang: "450" }))).toBe(3);
    expect(pageDuDebat(parseReunionParams({ rang: "450", debat: "1" }))).toBe(1);
    expect(pageDuDebat(parseReunionParams({}))).toBe(1);
  });

  it("réécrit l'URL sans les valeurs par défaut", () => {
    expect(
      buildHref("/reunions/X", reunionParamsOf(parseReunionParams({ vote: "v", debat: "1" }))),
    ).toBe("/reunions/X?vote=v");
    expect(buildHref("/reunions/X", reunionParamsOf(parseReunionParams({ debat: "3" })))).toBe(
      "/reunions/X?debat=3",
    );
  });
});
