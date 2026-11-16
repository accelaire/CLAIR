import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLES,
  DUREE_SILENCE_MS,
  doitRelancer,
  EVENEMENT_ACTION_FORTE,
  type Stockage,
  signalerActionForte,
} from "./relance.ts";

/** Stockage en mémoire, pour tester les règles sans navigateur. */
const memoire = (valeurs: Record<string, string> = {}): Stockage => {
  const donnees = new Map(Object.entries(valeurs));
  return {
    getItem: (cle) => donnees.get(cle) ?? null,
    setItem: (cle, valeur) => {
      donnees.set(cle, valeur);
    },
  };
};

const maintenant = 1_800_000_000_000;

describe("règles de relance : refus", () => {
  it("ne relance pas un visiteur qui a déjà répondu", () => {
    expect(
      doitRelancer(memoire({ [CLES.actions]: "5" }), memoire({ [CLES.repondu]: "1" }), maintenant),
    ).toBe(false);
  });

  it("ne relance pas pendant le silence demandé", () => {
    const local = memoire({ [CLES.silence]: String(maintenant + DUREE_SILENCE_MS) });
    expect(doitRelancer(memoire({ [CLES.actions]: "5" }), local, maintenant)).toBe(false);
  });

  it("ne relance pas deux fois dans la visite", () => {
    const session = memoire({ [CLES.actions]: "5", [CLES.relanceVue]: "1" });
    expect(doitRelancer(session, memoire(), maintenant)).toBe(false);
  });

  it("lit un compteur illisible comme zéro", () => {
    expect(doitRelancer(memoire({ [CLES.actions]: "abc" }), memoire(), maintenant)).toBe(false);
  });
});

describe("signalement d'une action forte", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("compte l'action, la marque forte et prévient le widget", () => {
    const ecouteur = vi.fn();
    window.addEventListener(EVENEMENT_ACTION_FORTE, ecouteur);
    signalerActionForte();
    window.removeEventListener(EVENEMENT_ACTION_FORTE, ecouteur);
    expect(window.sessionStorage.getItem(CLES.forte)).toBe("1");
    expect(window.sessionStorage.getItem(CLES.actions)).toBe("1");
    expect(ecouteur).toHaveBeenCalledTimes(1);
  });

  it("ne plante pas quand le stockage est refusé", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("stockage refusé");
    });
    expect(() => signalerActionForte()).not.toThrow();
  });
});
