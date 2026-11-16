import type { PriseDeParoleReunion, ScrutinDeSeance } from "@clair/data";
import { describe, expect, it } from "vitest";
import { grouperParSujet, votesApres } from "./debat.ts";
import { debatExemple } from "./fixtures.ts";

const [base] = debatExemple.data;
if (!base) throw new Error("fixture vide");

/** Prise FICTIVE dérivée de la fixture, sans sujet. */
const prise = (champs: Partial<PriseDeParoleReunion>): PriseDeParoleReunion => ({
  ...base,
  articleVise: null,
  amendementsVises: null,
  dossier: null,
  texteNumero: null,
  scrutinIds: [],
  ...champs,
});

const scrutin = (id: string): ScrutinDeSeance => ({
  id,
  numero: 1,
  titre: "Scrutin d'exemple",
  date: "2026-03-03T00:00:00.000Z",
  sort: "adopte",
  chambre: "assemblee",
  session: null,
  nombrePour: 1,
  nombreContre: 0,
  nombreAbstention: 0,
});

describe("grouperParSujet", () => {
  it("n'intitule pas un passage sans sujet", () => {
    const [passage] = grouperParSujet([prise({ id: "a" })]);
    expect(passage?.sousTitre).toBeNull();
    expect(passage?.texte).toBeNull();
  });

  it("garde « Article » déjà écrit et compte les amendements", () => {
    const [passage] = grouperParSujet([
      prise({ id: "a", articleVise: "Article 3 bis", amendementsVises: ["1", "2"] }),
    ]);
    expect(passage?.sousTitre).toBe("Article 3 bis · Amendements n° 1, n° 2");
  });

  it("ignore un article vide et nomme le texte par son numéro", () => {
    const [passage] = grouperParSujet([prise({ id: "a", articleVise: "  ", texteNumero: "512" })]);
    expect(passage?.sousTitre).toBeNull();
    expect(passage?.texte).toEqual({ uid: null, titre: "Texte n° 512" });
  });

  it("ouvre un passage à chaque changement de sujet", () => {
    const passages = grouperParSujet([
      prise({ id: "a", texteNumero: "1" }),
      prise({ id: "b", texteNumero: "1" }),
      prise({ id: "c", texteNumero: "2" }),
    ]);
    expect(passages.map((p) => p.prises.length)).toEqual([2, 1]);
  });
});

describe("votesApres", () => {
  it("place un vote après la dernière prise qui le cite, ignore un scrutin inconnu", () => {
    const parPrise = votesApres(
      [
        prise({ id: "a", scrutinIds: ["s1", "s2"] }),
        prise({ id: "b", scrutinIds: ["s1", "inconnu"] }),
      ],
      [scrutin("s1"), scrutin("s2")],
    );
    expect(parPrise.get("a")?.map((s) => s.id)).toEqual(["s2"]);
    expect(parPrise.get("b")?.map((s) => s.id)).toEqual(["s1"]);
  });
});
