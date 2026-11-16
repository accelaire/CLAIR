import type { FonctionGouvernementale, PersonneGouvernement, PosteMinisteriel } from "@clair/data";
import { describe, expect, it } from "vitest";
import {
  type Etape,
  fonctionEnCours,
  initiales,
  intituleAffiche,
  lienFiche,
  natureEtape,
  qualitePremierMinistre,
} from "./gouvernements.ts";

// Données fictives : personnes et postes inventés pour les tests.
const personne = (civilite: string | null): PersonneGouvernement => ({
  acteurUid: "PA-exemple",
  civilite,
  prenom: "Alix",
  nom: "Exemple",
  parlementaire: null,
});

const poste = (uid: string): PosteMinisteriel => ({
  uid,
  organeUid: `PO-${uid}`,
  qualite: "Ministre",
  rangProtocolaire: 20,
  intitule: "Ministère de l'exemple",
  intituleCourt: "Exemple",
  intituleComplement: null,
  domaine: null,
  dateDebut: "2026-01-01",
  dateFin: null,
  datePublication: null,
  membre: { ...personne("M."), acteurUid: uid },
});

const etape = (entrees: number, mutations: number, sorties: number): Etape => ({
  date: "2026-02-01",
  nature: "changement",
  entrees: Array.from({ length: entrees }, (_, i) => poste(`e${i}`)),
  mutations: Array.from({ length: mutations }, (_, i) => poste(`m${i}`)),
  sorties: Array.from({ length: sorties }, (_, i) => poste(`s${i}`)),
  composition: [],
});

const fonction = (partiel: Partial<FonctionGouvernementale>): FonctionGouvernementale => ({
  type: "poste_ministeriel",
  uid: "f-1",
  qualite: "Ministre",
  intitule: "Ministère des exemples",
  intituleCourt: "Exemples",
  dateDebut: "2025-01-01",
  dateFin: null,
  gouvernement: { uid: "g-1", slug: "gouvernement-exemple", nom: "Exemple" },
  ...partiel,
});

describe("intituleAffiche", () => {
  it("prend l'intitulé long faute d'intitulé court, avec une majuscule", () => {
    expect(intituleAffiche(null, "justice (garde des sceaux)")).toBe("Justice");
  });

  it("garde l'intitulé quand il n'est qu'une parenthèse", () => {
    expect(intituleAffiche("(II)", "Fonction publique")).toBe("(II)");
  });
});

describe("personnes", () => {
  it("accorde la qualité de Premier ministre à la civilité", () => {
    expect(qualitePremierMinistre(personne("Mme"))).toBe("Première ministre");
    expect(qualitePremierMinistre(personne("M."))).toBe("Premier ministre");
    expect(qualitePremierMinistre(personne(null))).toBe("Premier ministre");
  });

  it("donne les initiales et le lien de la fiche quand elle existe", () => {
    expect(initiales({ prenom: "alix", nom: "exemple" })).toBe("AE");
    expect(lienFiche(personne("M."))).toBeNull();
    expect(
      lienFiche({
        ...personne("M."),
        parlementaire: { slug: "alix-exemple", chambre: "senat", photoUrl: null },
      }),
    ).toBe("/senateurs/alix-exemple");
  });
});

describe("natureEtape", () => {
  it("distingue nomination, remaniement, départ(s) et changement", () => {
    expect(natureEtape({ ...etape(0, 0, 0), nature: "nomination" })).toBe("Nomination");
    expect(natureEtape(etape(2, 1, 0))).toBe("Remaniement");
    expect(natureEtape(etape(0, 0, 1))).toBe("Départ");
    expect(natureEtape(etape(0, 0, 2))).toBe("Départs");
    expect(natureEtape(etape(1, 0, 1))).toBe("Changement");
  });
});

describe("fonctionEnCours", () => {
  it("renvoie null sans fonction ou sans fonction en cours", () => {
    expect(fonctionEnCours(null, "F")).toBeNull();
    expect(fonctionEnCours([fonction({ dateFin: "2025-06-01" })], "F")).toBeNull();
  });

  it("met la présidence de la République avant tout, accordée au sexe", () => {
    const presidence = fonction({
      type: "presidence",
      qualite: "Président de la République",
      intitule: "Présidence",
      intituleCourt: null,
      gouvernement: null,
    });
    expect(fonctionEnCours([fonction({}), presidence], "F")).toMatchObject({
      titre: "Présidente de la République",
      dansUnTitre: "présidente de la République",
      gouvernement: null,
    });
    expect(fonctionEnCours([presidence], "M")?.titre).toBe("Président de la République");
  });

  it("met le Premier ministre avant un ministère par intérim", () => {
    const pm = fonction({
      uid: "pm",
      qualite: "Première ministre",
      intitule: "Première ministre",
      intituleCourt: null,
      dateDebut: "2024-01-01",
    });
    expect(fonctionEnCours([fonction({ dateDebut: "2025-03-01" }), pm], "F")).toMatchObject({
      titre: "Première ministre",
      dansUnTitre: "Première ministre",
    });
  });

  it("prend la fonction la plus récente à rang égal, et la décrit pour un titre", () => {
    const ancienne = fonction({ uid: "a", intituleCourt: "Armées", dateDebut: "2024-01-01" });
    const recente = fonction({ uid: "b", intituleCourt: "Culture", dateDebut: "2025-06-01" });
    expect(fonctionEnCours([ancienne, recente], "M")).toMatchObject({
      titre: "Ministre · Culture",
      dansUnTitre: "ministre (Culture)",
      depuis: "2025-06-01",
    });
  });
});
