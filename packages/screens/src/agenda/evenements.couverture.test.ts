import type { AgendaReunion } from "@clair/data";
import { describe, expect, it } from "vitest";
import {
  chambreDeReunion,
  joursCouverts,
  libelleDateEvenement,
  pageDedieePour,
} from "./evenements.ts";
import { evenementExemple, periodeExemple, reunionAgendaExemple } from "./fixtures.ts";

/** Réunion FICTIVE sans aucun indice de chambre. */
const sansIndice: AgendaReunion = {
  ...reunionAgendaExemple,
  commission: null,
  compteRenduRef: null,
  urlVideo: null,
  lieu: null,
};

describe("libelleDateEvenement", () => {
  it("n'affiche que le mois d'une date non fixée", () => {
    expect(libelleDateEvenement({ ...evenementExemple, datePrecise: false })).toBe(
      "Courant mars 2026",
    );
  });

  it("donne le jour d'un événement ponctuel et les bornes d'une période", () => {
    expect(libelleDateEvenement(evenementExemple)).toBe("10 mars 2026");
    expect(libelleDateEvenement(periodeExemple)).toBe("Du 20 mars 2026 au 31 mars 2026");
  });

  it("couvre chaque jour d'une période", () => {
    expect(joursCouverts(evenementExemple)).toEqual(["2026-03-10"]);
    expect(joursCouverts(periodeExemple)).toHaveLength(12);
  });
});

describe("pageDedieePour", () => {
  it("renvoie la page d'un événement instruit, rien sinon", () => {
    expect(pageDedieePour("bureau-senat-2026")?.href).toBe("/senatoriales-2026#resultats");
    expect(pageDedieePour("inconnu")).toBeNull();
  });
});

describe("chambreDeReunion", () => {
  it("lit la chambre de la commission", () => {
    expect(chambreDeReunion(reunionAgendaExemple)).toBe("assemblee");
  });

  it("lit la référence du compte rendu", () => {
    expect(chambreDeReunion({ ...sansIndice, compteRenduRef: "CRSANR1" })).toBe("assemblee");
    expect(chambreDeReunion({ ...sansIndice, compteRenduRef: "CRSSNR1" })).toBe("senat");
  });

  it("lit l'adresse de la vidéo", () => {
    expect(
      chambreDeReunion({ ...sansIndice, urlVideo: "https://videos.assemblee-nationale.fr/x" }),
    ).toBe("assemblee");
    expect(chambreDeReunion({ ...sansIndice, urlVideo: "https://videos.senat.fr/x" })).toBe(
      "senat",
    );
  });

  it("lit le lieu", () => {
    expect(chambreDeReunion({ ...sansIndice, lieu: "Palais Bourbon, salle 1" })).toBe("assemblee");
    expect(chambreDeReunion({ ...sansIndice, lieu: "Assemblée nationale" })).toBe("assemblee");
    expect(chambreDeReunion({ ...sansIndice, lieu: "Palais du Luxembourg" })).toBe("senat");
    expect(chambreDeReunion({ ...sansIndice, lieu: "Sénat, salle 2" })).toBe("senat");
  });

  it("ne devine rien sans indice", () => {
    expect(chambreDeReunion(sansIndice)).toBeNull();
    expect(
      chambreDeReunion({
        ...sansIndice,
        compteRenduRef: "CRCX",
        urlVideo: "https://video.exemple.test",
        lieu: "Salle d'exemple",
      }),
    ).toBeNull();
  });
});
