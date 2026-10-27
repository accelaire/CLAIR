import { describe, expect, it } from "vitest";
import {
  circonscriptionLisible,
  libelleLegislature,
  positionDeVote,
  scrutinHref,
} from "./chambre.ts";

describe("helpers des parlementaires", () => {
  it("écrit la législature en chiffres romains", () => {
    expect(libelleLegislature(17)).toBe("XVIIe législature");
    expect(libelleLegislature(1)).toBe("Ire législature");
    expect(libelleLegislature(14)).toBe("XIVe législature");
  });

  it("remplace le nom générique d'une circonscription de l'Assemblée", () => {
    expect(
      circonscriptionLisible({ nom: "09 - Circonscription 2", departement: "09", numero: 2 }),
    ).toEqual({ nom: "Département 09", departement: "", numero: 2 });
    const senat = { nom: "Hauts-de-Seine", departement: "92", numero: 0 };
    expect(circonscriptionLisible(senat)).toBe(senat);
  });

  it("reconnaît les positions de vote et identifie un scrutin par chambre et session", () => {
    expect(positionDeVote("pour")).toBe("pour");
    expect(positionDeVote("nonVotant")).toBe("non_votant");
    expect(positionDeVote("inconnue")).toBeNull();
    expect(scrutinHref({ numero: 28, chambre: "senat", session: "2025-2026" })).toBe(
      "/scrutins/28?chambre=senat&session=2025-2026",
    );
  });
});
