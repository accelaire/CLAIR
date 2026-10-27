import { describe, expect, it } from "vitest";
import { dossiersExemple, sujetExemple } from "./fixtures.ts";
import { etapesDuSujet } from "./parcours.ts";

describe("parcours d'un sujet", () => {
  it("reconstitue la navette quand aucun acte officiel n'est publié", () => {
    const etapes = etapesDuSujet(dossiersExemple.data, sujetExemple);
    expect(etapes.map((e) => `${e.code}:${e.status}`)).toEqual([
      "DEPOT:done",
      "AN1:done",
      "SN1:active",
      "ADOPT_DEF:done",
      "PROMULGATION:pending",
    ]);
    expect(etapes[0]?.chambre).toBe("both");
  });

  it("préfère les actes législatifs officiels du dossier de l'Assemblée", () => {
    const officiel = [
      { code: "AN1", label: "1re lecture", chambre: "assemblee" as const, status: "done" as const },
    ];
    const [an, senat] = dossiersExemple.data;
    if (!an || !senat) throw new Error("fixtures incomplètes");
    expect(etapesDuSujet([senat, { ...an, legislativeSteps: officiel }], sujetExemple)).toEqual(
      officiel,
    );
  });

  it("s'arrête au rejet d'un texte d'une seule chambre", () => {
    const [an] = dossiersExemple.data;
    if (!an) throw new Error("fixtures incomplètes");
    const etapes = etapesDuSujet([{ ...an, etat: "rejete" }], {
      ...sujetExemple,
      matchMethod: null,
    });
    expect(etapes.map((e) => e.code)).toEqual(["DEPOT", "EXAM", "REJETE"]);
  });
});
