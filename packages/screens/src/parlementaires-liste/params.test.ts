import { describe, expect, it } from "vitest";
import {
  groupesQueryOf,
  listeQueryOf,
  parlementairesListeParamsOf,
  parseParlementairesListeParams,
} from "./params.ts";

describe("parseParlementairesListeParams", () => {
  it("donne les valeurs par défaut sans paramètre", () => {
    expect(parseParlementairesListeParams({}, "assemblee")).toEqual({
      recherche: "",
      groupe: "",
      periode: "",
      tri: "nom",
      page: 1,
      comparer: [],
    });
  });

  it("lit la législature à l'Assemblée et la session au Sénat", () => {
    expect(parseParlementairesListeParams({ legislature: "16" }, "assemblee").periode).toBe("16");
    expect(parseParlementairesListeParams({ legislature: "16" }, "senat").periode).toBe("");
    expect(parseParlementairesListeParams({ session: "2025-2026" }, "senat").periode).toBe(
      "2025-2026",
    );
  });

  it("ignore un tri ou une page invalides et borne la sélection à quatre élus", () => {
    const filtres = parseParlementairesListeParams(
      { tri: "inconnu", page: "-3", compare: ["a,b", "c", "a", "d,e"] },
      "assemblee",
    );
    expect(filtres.tri).toBe("nom");
    expect(filtres.page).toBe(1);
    expect(filtres.comparer).toEqual(["a", "b", "c", "d"]);
  });
});

describe("parlementairesListeParamsOf", () => {
  it("écrit l'URL sans les valeurs par défaut, et relit la même chose", () => {
    const filtres = {
      recherche: "exemple",
      groupe: "exe",
      periode: "2025-2026",
      tri: "presence" as const,
      page: 2,
      comparer: ["a", "b"],
    };
    const params = parlementairesListeParamsOf(filtres, "senat");
    expect(params).toEqual({
      search: "exemple",
      groupe: "exe",
      session: "2025-2026",
      tri: "presence",
      page: "2",
      compare: "a,b",
    });
    expect(parseParlementairesListeParams(params, "senat")).toEqual(filtres);
    expect(
      parlementairesListeParamsOf(parseParlementairesListeParams({}, "assemblee"), "assemblee"),
    ).toEqual({});
  });
});

describe("listeQueryOf", () => {
  it("traduit le tri pour l'API", () => {
    expect(
      listeQueryOf(parseParlementairesListeParams({ tri: "presence" }, "assemblee"), "assemblee"),
    ).toEqual({ page: "1", limit: "24", sort: "presence", order: "desc" });
  });

  it("envoie la session du Sénat aux groupes en année de début, comme l'attend l'API", () => {
    const filtres = parseParlementairesListeParams({ session: "2024-2025" }, "senat");
    expect(groupesQueryOf(filtres, "senat")).toEqual({ session: "2024" });
    expect(listeQueryOf(filtres, "senat").session).toBe("2024-2025");
  });
});
