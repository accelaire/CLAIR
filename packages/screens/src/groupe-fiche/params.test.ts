import { buildHref } from "@clair/ui";
import { describe, expect, it } from "vitest";
import { groupeFicheParamsOf, parseGroupeFicheParams } from "./params.ts";

describe("paramètres de la fiche d'un groupe", () => {
  it("lit l'URL avec des valeurs par défaut", () => {
    expect(parseGroupeFicheParams({})).toEqual({
      legislature: "",
      session: "",
      initie: false,
      tri: "nom",
      ordre: "ascending",
    });
    expect(
      parseGroupeFicheParams({ legislature: "16", initie: "1", tri: "presence", session: "x" }),
    ).toEqual({
      legislature: "16",
      session: "",
      initie: true,
      tri: "presence",
      ordre: "descending",
    });
    expect(parseGroupeFicheParams({ tri: "inconnu", ordre: "desc" })).toMatchObject({
      tri: "nom",
      ordre: "descending",
    });
  });

  it("réécrit l'URL sans les valeurs par défaut", () => {
    const params = parseGroupeFicheParams({ session: "2020", tri: "loyaute" });
    expect(buildHref("/groupes/senat/uc", groupeFicheParamsOf(params))).toBe(
      "/groupes/senat/uc?session=2020&tri=loyaute",
    );
    expect(
      buildHref(
        "/groupes/senat/uc",
        groupeFicheParamsOf({ ...params, ordre: "ascending", initie: true }),
      ),
    ).toBe("/groupes/senat/uc?session=2020&initie=1&tri=loyaute&ordre=asc");
  });
});
