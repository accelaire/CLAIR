import { describe, expect, it } from "vitest";
import {
  libellePresence,
  nonClasse,
  pourcent,
  presenceCourte,
  presenceDe,
  presideUneAssemblee,
} from "./presence.ts";

describe("presenceDe", () => {
  it("prend la présence aux votes solennels pour un sénateur", () => {
    expect(presenceDe("senat", { presence: 100, presenceSolennel: 73 })).toBe(73);
  });

  it("rend null pour un sénateur sans scrutin solennel, jamais le taux tous scrutins", () => {
    expect(presenceDe("senat", { presence: 100, presenceSolennel: null })).toBeNull();
    expect(presenceDe("senat", { presence: 100 })).toBeNull();
  });

  it("garde le taux tous scrutins pour un député", () => {
    expect(presenceDe("assemblee", { presence: 64, presenceSolennel: 80 })).toBe(64);
  });

  it("rend null sans stats", () => {
    expect(presenceDe("assemblee", null)).toBeNull();
  });
});

describe("libellePresence", () => {
  it("nomme la présence du Sénat", () => {
    expect(libellePresence("senat")).toBe("Présence aux votes solennels");
    expect(libellePresence("assemblee")).toBe("Présence");
  });
});

describe("pourcent", () => {
  it("écrit un tiret plutôt que « null % »", () => {
    expect(pourcent(null)).toBe("—");
    expect(pourcent(undefined)).toBe("—");
    expect(pourcent(0)).toBe("0\u202f%");
    expect(pourcent(73.5)).toBe("73,5\u202f%");
  });
});

describe("nonClasse", () => {
  it("ne classe pas un député sous 50 scrutins, en présence comme en loyauté", () => {
    expect(nonClasse("assemblee", { classable: false }, "presence")).toBe(true);
    expect(nonClasse("assemblee", { classable: false }, "loyaute")).toBe(true);
  });

  it("classe toujours la présence d'un sénateur (solennels, sans seuil)", () => {
    expect(nonClasse("senat", { classable: false }, "presence")).toBe(false);
    expect(nonClasse("senat", { classable: false }, "loyaute")).toBe(true);
  });

  it("classe une ligne classable ou sans information", () => {
    expect(nonClasse("assemblee", { classable: true }, "presence")).toBe(false);
    expect(nonClasse("assemblee", {}, "presence")).toBe(false);
    expect(nonClasse("assemblee", { classable: false }, "amendements")).toBe(false);
  });
});

describe("presideUneAssemblee", () => {
  const fonction = (qualite: string, dateFin: string | null = null) => ({
    typeOrgane: "BUREAU",
    qualite,
    dateFin,
  });

  it("reconnaît la présidence en cours du Sénat ou de l'Assemblée", () => {
    expect(presideUneAssemblee([fonction("Président du Sénat")])).toBe(true);
    expect(presideUneAssemblee([fonction("Présidente de l’Assemblée nationale")])).toBe(true);
  });

  it("écarte une présidence passée, une vice-présidence ou un autre organe", () => {
    expect(presideUneAssemblee([fonction("Président du Sénat", "2020-01-01")])).toBe(false);
    expect(presideUneAssemblee([fonction("Vice-président du Sénat")])).toBe(false);
    expect(
      presideUneAssemblee([{ typeOrgane: "COMPER", qualite: "Président du Sénat", dateFin: null }]),
    ).toBe(false);
  });
});

describe("presenceCourte", () => {
  it("montre la présence aux solennels d'un sénateur, sinon sa participation, sinon rien", () => {
    expect(presenceCourte("senat", { presence: 100, presenceSolennel: 73 })).toEqual({
      libelle: "Présence (solennels)",
      valeur: 73,
    });
    expect(presenceCourte("senat", { presence: 98, presenceSolennel: null })).toEqual({
      libelle: "Participation",
      valeur: 98,
    });
    expect(presenceCourte("senat", { presence: null, presenceSolennel: null })).toBeNull();
  });

  it("garde la présence d'un député, même non mesurable", () => {
    expect(presenceCourte("assemblee", { presence: null, presenceSolennel: 80 })).toEqual({
      libelle: "Présence",
      valeur: null,
    });
  });
});
