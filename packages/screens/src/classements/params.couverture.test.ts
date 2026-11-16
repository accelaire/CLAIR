import { describe, expect, it } from "vitest";
import { classementsParamsOf, parseClassementsParams } from "./params.ts";

describe("paramètres des classements : valeurs non par défaut", () => {
  it("lit la carrière complète et l'écrit dans l'URL avec les autres choix", () => {
    const params = parseClassementsParams({
      tab: "groupes",
      periode: "carriere",
      sort: "loyaute",
      order: "asc",
      groupeSort: "cohesion",
    });
    expect(params.periode).toBe("carriere");
    expect(classementsParamsOf(params)).toMatchObject({
      tab: "groupes",
      sort: "loyaute",
      order: "asc",
      periode: "carriere",
      groupeSort: "cohesion",
    });
  });
});
