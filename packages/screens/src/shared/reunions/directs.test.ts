import type { DirectsDuJour } from "@clair/data";
import { describe, expect, it } from "vitest";
import { lienDuDirect } from "./directs.ts";

// Directs fictifs.
const directs: DirectsDuJour = {
  commissions: [
    { organeRef: "PO1", directUrl: "https://direct.test/commission", chambre: "assemblee" },
  ],
  seances: [
    {
      isoDate: "2026-11-12",
      order: 1,
      directUrl: "https://direct.test/an-1",
      chambre: "assemblee",
    },
    {
      isoDate: "2026-11-12",
      order: 2,
      directUrl: "https://direct.test/an-2",
      chambre: "assemblee",
    },
    {
      isoDate: "2026-11-12",
      order: 3,
      directUrl: "https://direct.test/senat-soir",
      chambre: "senat",
    },
  ],
};

const reunion = (patch: Partial<Parameters<typeof lienDuDirect>[0]> = {}) => ({
  type: "seance",
  dateDebut: "2026-11-12T14:00:00Z",
  compteRenduRef: null,
  commission: null,
  ...patch,
});

describe("lienDuDirect", () => {
  it("rapproche une commission par son organe", () => {
    expect(
      lienDuDirect(
        reunion({ type: "commission", commission: { organeRef: "PO1" } }),
        "assemblee",
        directs,
      ),
    ).toBe("https://direct.test/commission");
  });

  it("rapproche une séance par son rang, tiré du compte rendu", () => {
    expect(
      lienDuDirect(reunion({ compteRenduRef: "CRSANR5L17S2027O1N2" }), "assemblee", directs),
    ).toBe("https://direct.test/an-2");
  });

  it("rapproche une séance par la date et la chambre, à défaut de rang", () => {
    expect(lienDuDirect(reunion(), "senat", directs)).toBe("https://direct.test/senat-soir");
  });

  it("ne rapproche rien sans direct, sans chambre, ou pour une commission sans organe connu", () => {
    expect(lienDuDirect(reunion(), "assemblee", undefined)).toBeUndefined();
    expect(lienDuDirect(reunion(), null, directs)).toBeUndefined();
    expect(lienDuDirect(reunion({ type: "commission" }), "assemblee", directs)).toBeUndefined();
    expect(
      lienDuDirect(reunion({ dateDebut: "2026-11-13T14:00:00Z" }), "assemblee", directs),
    ).toBeUndefined();
  });
});
