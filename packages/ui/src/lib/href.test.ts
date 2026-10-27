import { describe, expect, it } from "vitest";
import { asArray, asString, buildHref, toggle } from "./href.ts";

describe("buildHref", () => {
  it("omet les valeurs vides et répète les listes", () => {
    expect(buildHref("/deputes", { q: "", groupe: ["RN", "LFI"], page: 2, actifs: false })).toBe(
      "/deputes?groupe=RN&groupe=LFI&page=2",
    );
  });

  it("renvoie le chemin seul sans paramètre", () => {
    expect(buildHref("/scrutins", { q: null })).toBe("/scrutins");
  });
});

describe("paramètres d'URL", () => {
  it("lit une valeur ou une liste", () => {
    expect(asArray(undefined)).toEqual([]);
    expect(asArray("a")).toEqual(["a"]);
    expect(asString(["a", "b"])).toBe("a");
    expect(asString(undefined)).toBe("");
  });

  it("ajoute ou retire une valeur", () => {
    expect(toggle(["a"], "b")).toEqual(["a", "b"]);
    expect(toggle(["a", "b"], "a")).toEqual(["b"]);
  });
});
