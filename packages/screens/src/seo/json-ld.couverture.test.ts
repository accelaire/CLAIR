import { describe, expect, it } from "vitest";
import { ficheExemple } from "../parlementaire-fiche/fixtures.ts";
import {
  groupeJsonLd,
  lobbyisteJsonLd,
  organisationJsonLd,
  parlementaireJsonLd,
  scrutinJsonLd,
} from "./json-ld.ts";

const BASE = "https://clair.vote/";

describe("parlementaireJsonLd, données partielles", () => {
  it("omet ce que la fiche ne donne pas", () => {
    const data = parlementaireJsonLd(
      BASE,
      {
        ...ficheExemple,
        photoUrl: null,
        circonscription: null,
        dateNaissance: null,
        email: null,
        twitter: null,
        facebook: null,
        siteWeb: null,
        groupe: null,
      },
      "assemblee",
    );
    expect(data.url).toBe("https://clair.vote/deputes/camille-exemple");
    expect(data.image).toBeUndefined();
    expect(data.description).toBeUndefined();
    expect(data.birthDate).toBeUndefined();
    expect(data.email).toBeUndefined();
    expect(data.sameAs).toBeUndefined();
    expect(data.worksFor).toBeUndefined();
  });

  it("reprend photo, réseaux et nom court du groupe", () => {
    const groupe = ficheExemple.groupe;
    if (!groupe) throw new Error("fixture sans groupe");
    const data = parlementaireJsonLd(
      BASE,
      {
        ...ficheExemple,
        photoUrl: "https://photo.exemple.test/c.jpg",
        facebook: "https://facebook.exemple.test/c",
        groupe: { ...groupe, nomComplet: "" },
      },
      "assemblee",
    );
    expect(data.image).toBe("https://photo.exemple.test/c.jpg");
    expect(data.sameAs).toEqual(["https://facebook.exemple.test/c"]);
    expect(data.worksFor).toEqual({ "@type": "Organization", name: groupe.nom });
  });
});

describe("autres types, cas limites", () => {
  it("nomme un groupe sans nom complet par son sigle, avec son logo", () => {
    const data = groupeJsonLd(BASE, {
      chambre: "senat",
      slug: "exe",
      nom: "EXE",
      nomComplet: null,
      logoUrl: "https://logo.exemple.test/exe.png",
      membresActifsCount: 3,
    });
    expect(data.name).toBe("EXE");
    expect(data.alternateName).toBeUndefined();
    expect(data.logo).toBe("https://logo.exemple.test/exe.png");
    expect(data.description).toBe("Groupe politique — Sénat — 3 membres");
  });

  it("dit rejeté un scrutin rejeté de l'Assemblée", () => {
    const data = scrutinJsonLd(
      {
        numero: 1,
        titre: "Amendement d'exemple",
        chambre: "assemblee",
        date: "2026-03-12",
        sort: "rejeté",
        nombrePour: 1,
        nombreContre: 2,
        nombreAbstention: 0,
      },
      "https://clair.vote/scrutins/1",
    );
    expect(data.organizer).toMatchObject({ name: "Assemblée nationale" });
    expect(data.additionalProperty).toContainEqual(
      expect.objectContaining({ name: "result", value: "Rejeté" }),
    );
  });

  it("décrit un lobbyiste par son secteur, sans effectif ni adresse inconnus", () => {
    const data = lobbyisteJsonLd(BASE, {
      id: "x",
      nom: "Org",
      secteur: "Agriculture",
      ville: null,
      nbLobbyistes: null,
    });
    expect(data.description).toBe("Org — Agriculture");
    expect(data.numberOfEmployees).toBeUndefined();
    expect(data.address).toBeUndefined();
  });

  it("donne une adresse absolue au logo de l'association", () => {
    expect(organisationJsonLd("https://clair.vote")).toMatchObject({
      logo: "https://clair.vote/icon.png",
    });
  });
});
