import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sansDonneesSource } from "./donnees-source.ts";

describe("sansDonneesSource", () => {
  it("retire sourceData au premier niveau et en profondeur, dans les objets et les tableaux", () => {
    // Forme d'une fiche : la ressource, ses mandats (inclus par l'API) et leur groupe.
    const reponse = {
      data: {
        slug: "fiche-fictive",
        sourceData: { brut: "x".repeat(100) },
        mandatsParlementaires: [
          {
            legislature: 17,
            sourceData: { brut: 1 },
            groupe: { nom: "Groupe fictif", sourceData: null },
          },
        ],
      },
      meta: { total: 1 },
    };
    assert.deepEqual(sansDonneesSource(reponse), {
      data: {
        slug: "fiche-fictive",
        mandatsParlementaires: [{ legislature: 17, groupe: { nom: "Groupe fictif" } }],
      },
      meta: { total: 1 },
    });
  });

  it("ne modifie pas la réponse d'origine", () => {
    const reponse = { data: { sourceData: 1, nom: "a" } };
    sansDonneesSource(reponse);
    assert.deepEqual(reponse, { data: { sourceData: 1, nom: "a" } });
  });

  it("laisse passer les valeurs simples et les tableaux de valeurs simples", () => {
    assert.equal(sansDonneesSource(null), null);
    assert.equal(sansDonneesSource("texte"), "texte");
    assert.deepEqual(sansDonneesSource([1, "a", null]), [1, "a", null]);
  });
});
