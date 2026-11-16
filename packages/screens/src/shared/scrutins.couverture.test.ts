import { describe, expect, it } from "vitest";
import {
  legislatureLabel,
  legislatureRomaine,
  parlementaireHref,
  periodeScrutin,
  pluriel,
  scrutinHref,
  scrutinQuery,
  sessionLabel,
} from "./scrutins.ts";

describe("scrutinQuery et scrutinHref", () => {
  it("prend l'Assemblée par défaut et omet une session absente", () => {
    expect(scrutinQuery({ chambre: null, session: null })).toEqual({ chambre: "assemblee" });
    expect(scrutinHref({ numero: 42 })).toBe("/scrutins/42?chambre=assemblee");
  });

  it("transporte la chambre et la session", () => {
    expect(scrutinHref({ numero: "7", chambre: "senat", session: "2025" })).toBe(
      "/scrutins/7?chambre=senat&session=2025",
    );
  });
});

describe("parlementaireHref", () => {
  it("mène aux sénateurs pour le Sénat, aux députés sinon", () => {
    expect(parlementaireHref("senat", "jeanne-exemple")).toBe("/senateurs/jeanne-exemple");
    expect(parlementaireHref("assemblee", "paul-exemple")).toBe("/deputes/paul-exemple");
    expect(parlementaireHref(null, "paul-exemple")).toBe("/deputes/paul-exemple");
  });
});

describe("libellés de période", () => {
  it("écrit la législature en chiffres romains, ou en chiffres hors table", () => {
    expect(legislatureRomaine(17)).toBe("XVIIe");
    expect(legislatureRomaine(5)).toBe("5e");
    expect(legislatureLabel(16)).toBe("XVIe législature");
  });

  it("écrit la session du Sénat, numérique ou non", () => {
    expect(sessionLabel("2025")).toBe("Session 2025-2026");
    expect(sessionLabel("extra")).toBe("Session extra");
  });

  it("donne la période d'un scrutin du Sénat", () => {
    expect(periodeScrutin({ chambre: "senat", session: "2024" })).toBe("Session 2024-2025");
    expect(periodeScrutin({ chambre: "senat", session: null })).toBeNull();
  });

  it("donne la période d'un scrutin de l'Assemblée, par législature ou session", () => {
    expect(periodeScrutin({ chambre: "assemblee", legislature: 17 })).toBe("XVIIe législature");
    expect(periodeScrutin({ chambre: "assemblee", session: "16" })).toBe("XVIe législature");
    expect(periodeScrutin({ chambre: "assemblee", session: null, legislature: null })).toBeNull();
    expect(periodeScrutin({ chambre: "assemblee", session: "inconnue" })).toBeNull();
  });
});

describe("pluriel", () => {
  it("accorde le mot", () => {
    expect(pluriel(1, "scrutin")).toBe("1 scrutin");
    expect(pluriel(12, "scrutin")).toBe("12 scrutins");
    expect(pluriel(2, "œil", "yeux")).toBe("2 yeux");
  });
});
