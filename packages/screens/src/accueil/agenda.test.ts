import { describe, expect, it } from "vitest";
import {
  chambreDeReunion,
  heureDe,
  joursDuPlanning,
  reunionsVisibles,
  titreDuJour,
} from "./agenda.ts";
import { reunionCommission, reunionMercredi, reunionSeance, reunionsDuMardi } from "./fixtures.ts";

describe("planning de l'accueil", () => {
  it("regroupe les réunions par jour, à l'heure de Paris", () => {
    const tardive = { ...reunionSeance, id: "tard", dateDebut: "2026-03-03T23:30:00.000Z" };
    const jours = joursDuPlanning([...reunionsDuMardi, tardive, reunionMercredi], []);
    expect(jours.map((jour) => jour.jour)).toEqual(["2026-03-03", "2026-03-04"]);
    expect(jours[0]?.reunions).toHaveLength(4);
    expect(jours[1]?.reunions.map((reunion) => reunion.id)).toEqual(["tard", reunionMercredi.id]);
  });

  it("rattache un repère institutionnel à chaque jour qu'il couvre", () => {
    const session = {
      id: "s",
      slug: "s",
      type: "session" as const,
      titre: "Exemple : session",
      description: null,
      dateDebut: "2026-03-01T00:00:00.000Z",
      dateFin: "2026-03-03T00:00:00.000Z",
      datePrecise: true,
      chambre: null,
      sources: null,
      important: false,
    };
    const jours = joursDuPlanning([reunionSeance, reunionMercredi], [session]);
    expect(jours[0]?.evenements).toEqual([session]);
    expect(jours[1]?.evenements).toEqual([]);
  });

  it("montre trois réunions par jour, plus celles en cours", () => {
    expect(reunionsVisibles(reunionsDuMardi, null)).toMatchObject({ restantes: 1 });
    const pendant = new Date("2026-03-03T16:30:00.000Z");
    expect(reunionsVisibles(reunionsDuMardi, pendant)).toMatchObject({ restantes: 0 });
  });

  it("formate jour et heure en français, heure de Paris", () => {
    expect(titreDuJour("2026-03-03")).toBe("Mardi 3 mars");
    expect(heureDe("2026-03-03T14:00:00.000Z")).toBe("15:00");
  });

  it("déduit la chambre de la commission ou du compte rendu", () => {
    expect(chambreDeReunion(reunionCommission)).toBe("senat");
    expect(chambreDeReunion(reunionSeance)).toBe("assemblee");
    expect(
      chambreDeReunion({ ...reunionSeance, compteRenduRef: null, lieu: "Palais du Luxembourg" }),
    ).toBe("senat");
    expect(chambreDeReunion({ ...reunionSeance, compteRenduRef: null, lieu: null })).toBeNull();
  });
});
