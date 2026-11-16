import type { SujetDossier } from "@clair/data";
import { describe, expect, it } from "vitest";
import { dossiersExemple, sujetExemple } from "./fixtures.ts";
import { etapesDuSujet } from "./parcours.ts";

const [an, senat] = dossiersExemple.data;
if (!an || !senat) throw new Error("fixtures incomplètes");

const sansNavette = { ...sujetExemple, matchMethod: null };
const resume = (dossiers: SujetDossier[], sujet = sujetExemple) =>
  etapesDuSujet(dossiers, sujet).map((e) => `${e.code}:${e.status}:${e.outcome ?? "-"}`);

describe("parcours d'un sujet : cas limites", () => {
  it("prend le premier dossier qui a des actes officiels quand aucun n'est de l'Assemblée", () => {
    const officiel = [
      { code: "SN1", label: "1re lecture", chambre: "senat" as const, status: "active" as const },
    ];
    expect(etapesDuSujet([{ ...senat, legislativeSteps: officiel }], sujetExemple)).toEqual(
      officiel,
    );
  });

  it("navette d'un texte promulgué : adoption définitive et loi publiée", () => {
    const promulgue: SujetDossier = {
      ...an,
      etat: "promulgue",
      loiNumero: "2026-12",
      loiDateJO: "2026-06-01T00:00:00.000Z",
    };
    const etapes = etapesDuSujet([promulgue, { ...senat, etat: null }], sujetExemple);
    expect(etapes.map((e) => `${e.code}:${e.status}:${e.outcome ?? "-"}`)).toEqual([
      "DEPOT:done:-",
      "AN1:done:adopted",
      "SN1:pending:-",
      "ADOPT_DEF:done:adopted_definitive",
      "PROMULGATION:done:adopted",
    ]);
    const promulgation = etapes.at(-1);
    expect(promulgation?.detail).toBe("Loi n° 2026-12");
    expect(promulgation?.date).toBe("2026-06-01T00:00:00.000Z");
  });

  it("promulgation sans numéro ni date de JO : date de fin du sujet", () => {
    const etapes = etapesDuSujet([{ ...an, etat: "promulgue" }], {
      ...sansNavette,
      dateFin: "2026-07-01T00:00:00.000Z",
    });
    const promulgation = etapes.at(-1);
    expect(promulgation?.code).toBe("PROMULGATION");
    expect(promulgation?.detail).toBeNull();
    expect(promulgation?.date).toBe("2026-07-01T00:00:00.000Z");
  });

  it("navette entièrement rejetée : ni adoption définitive ni promulgation", () => {
    expect(
      resume([
        { ...an, etat: "rejete", dateAdoption: null },
        { ...senat, etat: "rejete" },
      ]),
    ).toEqual(["DEPOT:done:-", "AN1:done:rejected", "SN1:done:rejected"]);
  });

  it("navette sans dossier : chambres vides, dépôt sans date", () => {
    const etapes = etapesDuSujet([], sujetExemple);
    expect(etapes[0]?.chambre).toBe("senat");
    expect(etapes[0]?.date).toBeNull();
    expect(etapes.map((e) => e.code)).toEqual(["DEPOT", "AN1", "SN1", "ADOPT_DEF", "PROMULGATION"]);
    expect(etapes[1]?.detail).toBeNull();
    expect(etapes[1]?.status).toBe("pending");
    expect(etapes[3]?.status).toBe("pending");
  });

  it("navette du seul Sénat : dépôt au Sénat, date d'adoption du Sénat", () => {
    const etapes = etapesDuSujet(
      [{ ...senat, etat: "adopte", dateAdoption: "2026-04-01T00:00:00.000Z", dateDepot: null }],
      sujetExemple,
    );
    expect(etapes[0]?.chambre).toBe("senat");
    expect(etapes[2]?.date).toBe("2026-04-01T00:00:00.000Z");
    expect(etapes[2]?.detail).toBe("1 scrutins");
  });

  it("texte d'une chambre en cours : examen actif, adoption en attente", () => {
    const etapes = etapesDuSujet([{ ...an, etat: "en_cours" }], {
      ...sansNavette,
      scrutinCount: 1,
    });
    expect(etapes.map((e) => `${e.code}:${e.status}:${e.outcome ?? "-"}`)).toEqual([
      "DEPOT:done:-",
      "EXAM:active:-",
      "ADOPT:pending:-",
      "PROMULGATION:pending:-",
    ]);
    expect(etapes[0]?.chambre).toBe("assemblee");
    expect(etapes[1]?.detail).toBe("1 scrutin");
    expect(etapes[2]?.date).toBeNull();
  });

  it("texte du Sénat adopté : adoption datée, plusieurs scrutins", () => {
    const etapes = etapesDuSujet(
      [{ ...senat, etat: "adopte", dateAdoption: "2026-04-01T00:00:00.000Z" }],
      sansNavette,
    );
    expect(etapes[1]?.chambre).toBe("senat");
    expect(etapes[1]?.status).toBe("done");
    expect(etapes[1]?.detail).toBe("2 scrutins");
    expect(etapes[2]).toMatchObject({
      code: "ADOPT",
      status: "done",
      outcome: "adopted",
      date: "2026-04-01T00:00:00.000Z",
    });
  });

  it("sujet sans dossier ni navette : examen actif au Sénat", () => {
    const etapes = etapesDuSujet([], sansNavette);
    expect(etapes.map((e) => `${e.code}:${e.status}`)).toEqual([
      "DEPOT:done",
      "EXAM:active",
      "ADOPT:pending",
      "PROMULGATION:pending",
    ]);
  });

  it("texte d'une chambre dans un état inconnu : terminé sans issue", () => {
    const etapes = etapesDuSujet([{ ...an, etat: "caduc" }], sansNavette);
    expect(etapes[2]).toMatchObject({ code: "ADOPT", status: "done", outcome: null });
  });
});
