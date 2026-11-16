import type { ParlementaireDetail } from "@clair/data";
import { describe, expect, it } from "vitest";
import { ficheExemple } from "./fixtures.ts";
import { metaFiche, nombreMandats, titreBilan } from "./meta.ts";

const mandat = ficheExemple.mandatsParlementaires[0];
if (!mandat) throw new Error("fixture sans mandat");

describe("nombreMandats", () => {
  it("compte les législatures distinctes à l'Assemblée et les mandatures au Sénat", () => {
    const fiche: Pick<ParlementaireDetail, "mandatsParlementaires"> = {
      mandatsParlementaires: [
        mandat,
        { ...mandat, id: "m16", legislature: 16 },
        { ...mandat, id: "m16b", legislature: 16 },
        { ...mandat, id: "s1", chambre: "senat", legislature: null, mandature: 2017 },
        { ...mandat, id: "s2", chambre: "senat", legislature: null, mandature: null },
      ],
    };
    expect(nombreMandats(fiche, "assemblee")).toBe(2);
    expect(nombreMandats(fiche, "senat")).toBe(1);
  });
});

describe("titreBilan", () => {
  it("accorde au nombre de mandats", () => {
    expect(titreBilan(true)).toBe("Bilan de ses mandats");
    expect(titreBilan(false)).toBe("Bilan de son mandat");
  });
});

describe("metaFiche", () => {
  it("cite les volumes d'activité d'une députée en exercice", () => {
    const { title, description } = metaFiche(ficheExemple, "assemblee");
    expect(title).toBe("Camille Exemple, députée — votes et activité");
    expect(description).toBe(
      "Camille Exemple (EXE), députée. 120 votes, 4 interventions, 3 amendements déposés, 95 % de loyauté au groupe. Mis à jour chaque jour.",
    );
  });

  it("décrit un ancien sénateur sans groupe ni statistiques, avec le bilan de son mandat", () => {
    const fiche: ParlementaireDetail = {
      ...ficheExemple,
      sexe: "M",
      actif: false,
      groupe: null,
      stats: undefined,
    };
    expect(metaFiche(fiche, "senat").description).toBe(
      "Camille Exemple, ancien sénateur. Ses votes, ses interventions et ses amendements. Bilan de son mandat.",
    );
  });

  it("parle des mandats au pluriel et omet les volumes nuls", () => {
    const fiche: ParlementaireDetail = {
      ...ficheExemple,
      actif: false,
      mandatsParlementaires: [mandat, { ...mandat, id: "m16", legislature: 16 }],
      stats: ficheExemple.stats
        ? {
            ...ficheExemple.stats,
            participation: 0,
            interventions: 0,
            loyaute: null,
            amendements: { proposes: 5, adoptes: 0 },
          }
        : undefined,
    };
    expect(metaFiche(fiche, "assemblee").description).toBe(
      "Camille Exemple (EXE), ancienne députée. 5 amendements déposés. Bilan de ses mandats.",
    );
  });

  it("met la fonction au Gouvernement en cours avant le mandat", () => {
    const fiche: ParlementaireDetail = {
      ...ficheExemple,
      fonctionsGouvernementales: [
        {
          type: "poste_ministeriel",
          uid: "f-1",
          qualite: "Ministre",
          intitule: "Ministère des exemples",
          intituleCourt: "Exemples",
          dateDebut: "2025-01-01",
          dateFin: null,
          gouvernement: null,
        },
      ],
    };
    expect(metaFiche(fiche, "assemblee").title).toBe(
      "Camille Exemple, ministre (Exemples), députée — votes et activité",
    );
  });
});
