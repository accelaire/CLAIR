import { describe, expect, it } from "vitest";
import {
  archiveHref,
  archivesQueryOf,
  bornesArchive,
  moisVoisins,
  parseAnnee,
  parseMois,
  parseVotesArchivesParams,
  votesArchivesParamsOf,
} from "./params.ts";

const AUJOURDHUI = new Date(2026, 9, 26);

describe("paramètres des archives des votes", () => {
  it("valide l'année et le mois de l'adresse", () => {
    expect(parseAnnee("2025", AUJOURDHUI)).toBe(2025);
    expect(parseAnnee("2005", AUJOURDHUI)).toBeNull();
    expect(parseAnnee("2027", AUJOURDHUI)).toBeNull();
    expect(parseAnnee("25", AUJOURDHUI)).toBeNull();
    expect(parseMois("03")).toBe(3);
    expect(parseMois("3")).toBeNull();
    expect(parseMois("13")).toBeNull();
  });

  it("calcule les bornes de la période", () => {
    expect(bornesArchive({ annee: 2024, mois: null })).toEqual({
      dateFrom: "2024-01-01",
      dateTo: "2024-12-31",
    });
    expect(bornesArchive({ annee: 2024, mois: 2 })).toEqual({
      dateFrom: "2024-02-01",
      dateTo: "2024-02-29",
    });
    expect(archivesQueryOf({ annee: 2024, mois: 2 }, { page: 2 })).toMatchObject({
      page: "2",
      limit: "50",
    });
  });

  it("lit et écrit la page", () => {
    expect(parseVotesArchivesParams({ page: "3" })).toEqual({ page: 3 });
    expect(votesArchivesParamsOf({ page: 1 })).toEqual({ page: null });
  });

  it("borne les mois voisins", () => {
    expect(moisVoisins(2026, 10, AUJOURDHUI)).toEqual({
      precedent: { annee: 2026, mois: 9 },
      suivant: null,
    });
    expect(moisVoisins(2006, 1, AUJOURDHUI).precedent).toBeNull();
    expect(archiveHref({ annee: 2025, mois: 12 })).toBe("/votes/2025/12");
  });
});
