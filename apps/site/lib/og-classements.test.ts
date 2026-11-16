import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  depuisAncienneImage,
  OG_CLASSEMENTS_VERSION,
  queryImageClassements,
} from "./og-classements.ts";

const v = `v=${OG_CLASSEMENTS_VERSION}`;

describe("queryImageClassements", () => {
  it("garde l'onglet, la chambre, le critère et le parlementaire mis en avant", () => {
    assert.equal(
      queryImageClassements({
        tab: "groupes",
        chambre: "senat",
        groupeSort: "cohesion",
        page: "3",
        order: "asc",
      }),
      `tab=groupes&chambre=senat&groupeSort=cohesion&${v}`,
    );
    assert.equal(
      queryImageClassements({ sort: ["loyaute", "presence"], highlight: "jean-dupont", rank: "4" }),
      `sort=loyaute&highlight=jean-dupont&rank=4&${v}`,
    );
  });

  it("omet les valeurs vides", () => {
    assert.equal(queryImageClassements({ chambre: "", sort: undefined }), v);
  });
});

describe("depuisAncienneImage", () => {
  const ancienne = (query: string) => depuisAncienneImage(new URLSearchParams(query));

  it("traduit les trois types de apps/web", () => {
    assert.equal(
      ancienne("type=classement&sort=amendements&chambre=assemblee"),
      `chambre=assemblee&sort=amendements&${v}`,
    );
    assert.equal(
      ancienne("type=classement-parlementaire&slug=jean-dupont&sort=presence&rank=12"),
      `sort=presence&highlight=jean-dupont&rank=12&${v}`,
    );
    assert.equal(
      ancienne("type=classement-groupes&chambre=senat&sort=loyaute"),
      `tab=groupes&chambre=senat&groupeSort=loyaute&${v}`,
    );
  });

  it("refuse un autre type", () => {
    assert.equal(ancienne("type=depute&slug=x"), null);
    assert.equal(ancienne(""), null);
  });
});
