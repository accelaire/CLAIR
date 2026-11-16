import type { FonctionGouvernementale, PosteMinisteriel } from "@clair/data";
import { describe, expect, it } from "vitest";
import {
  de,
  duree,
  etapes,
  fonctionEnCours,
  intituleAffiche,
  libellePoste,
  natureEtape,
  parDomaine,
  titreDuRang,
} from "./gouvernements.ts";

// Données fictives : personnes et postes inventés pour les tests.
const poste = (
  uid: string,
  personne: string,
  dateDebut: string,
  dateFin: string | null,
  rang = 20,
  domaine: string | null = "economie",
): PosteMinisteriel => ({
  uid,
  organeUid: `PO-${uid}`,
  qualite: rang === 1 ? "Premier ministre" : "Ministre",
  rangProtocolaire: rang,
  intitule: rang === 1 ? "Premier ministre" : "Ministère de l'exemple",
  intituleCourt: rang === 1 ? "Premier ministre" : "Exemple",
  intituleComplement: null,
  domaine,
  dateDebut,
  dateFin,
  datePublication: null,
  membre: {
    acteurUid: personne,
    civilite: "M.",
    prenom: "Prénom",
    nom: personne,
    parlementaire: null,
  },
});

describe("duree", () => {
  it("compte les ans et les mois, ou les jours sous un mois", () => {
    expect(duree("2024-01-10", "2026-04-10")).toBe("2 ans et 3 mois");
    expect(duree("2024-01-10", "2024-05-09")).toBe("3 mois");
    expect(duree("2024-01-10", "2024-02-06")).toBe("27 jours");
  });
});

describe("intitulés", () => {
  it("retire la précision de l'AN, garde le complément du titre", () => {
    expect(intituleAffiche("Fonction publique (II)", "x")).toBe("Fonction publique");
    expect(intituleAffiche("affaires étrangères (et européennes)", "x")).toBe(
      "Affaires étrangères (et européennes)",
    );
  });

  it("ne répète pas le portefeuille que la qualité nomme déjà", () => {
    expect(libellePoste("Ministre", "Armées", "Ministère des armées")).toBe("Ministre · Armées");
    expect(libellePoste("Premier ministre", "Premier ministre", "Premier ministre")).toBe(
      "Premier ministre",
    );
  });

  it("élide « de » et range les rangs protocolaires", () => {
    expect(de("Emmanuel Exemple")).toBe("d’Emmanuel Exemple");
    expect(de("Jacques Exemple")).toBe("de Jacques Exemple");
    expect(titreDuRang(40)).toBe("Ministres délégués");
    expect(titreDuRang(99)).toBe("Autres membres");
  });
});

describe("etapes", () => {
  const g = { dateDebut: "2025-01-01", dateFin: null };

  it("prend la première vague d'entrées pour la nomination quand le PM est seul", () => {
    const postes = [
      poste("p1", "A", "2025-01-01", null, 1),
      poste("p2", "B", "2025-01-10", null),
      poste("p3", "C", "2025-01-10", null),
    ];
    const liste = etapes(g, postes);
    expect(liste).toHaveLength(1);
    expect(liste[0]?.nature).toBe("nomination");
    expect(liste[0]?.composition).toHaveLength(3);
  });

  it("fusionne un départ de la veille avec les entrées du lendemain, et repère les mutations", () => {
    const postes = [
      poste("p1", "A", "2025-01-01", null, 1),
      poste("p2", "B", "2025-01-01", "2025-06-01"),
      poste("p3", "C", "2025-01-01", "2025-06-01"),
      poste("p4", "B", "2025-06-02", null, 40),
      poste("p5", "D", "2025-06-02", null),
    ];
    const liste = etapes(g, postes);
    expect(liste).toHaveLength(2);
    const [, changement] = liste;
    expect(changement?.date).toBe("2025-06-02");
    expect(changement?.mutations.map((p) => p.uid)).toEqual(["p4"]);
    expect(changement?.entrees.map((p) => p.uid)).toEqual(["p5"]);
    expect(changement?.sorties.map((p) => p.uid)).toEqual(["p3"]);
    expect(changement && natureEtape(changement)).toBe("Changement");
  });
});

describe("parDomaine", () => {
  it("range par domaine, ceux sans domaine connu à la fin", () => {
    const groupes = parDomaine(
      [poste("p1", "A", "2025-01-01", null, 20, null), poste("p2", "B", "2025-01-01", null)],
      [{ cle: "economie", libelle: "Économie" }],
    );
    expect(groupes.map((x) => x.domaine.libelle)).toEqual(["Économie", "Autres portefeuilles"]);
  });
});

describe("fonctionEnCours", () => {
  const fonction = (surcharge: Partial<FonctionGouvernementale> = {}): FonctionGouvernementale => ({
    type: "poste_ministeriel",
    uid: "PM1",
    qualite: "Ministre",
    intitule: "Ministère des armées",
    intituleCourt: "Armées",
    dateDebut: "2025-01-01",
    dateFin: null,
    gouvernement: { uid: "PO1", slug: "exemple", nom: "Exemple" },
    ...surcharge,
  });

  it("rend null sans fonction en cours", () => {
    expect(fonctionEnCours([fonction({ dateFin: "2025-02-01" })], "M")).toBeNull();
    expect(fonctionEnCours(undefined, "M")).toBeNull();
  });

  it("préfère le poste de Premier ministre à un intérim", () => {
    const resultat = fonctionEnCours(
      [
        fonction({ dateDebut: "2025-03-01" }),
        fonction({
          uid: "PM2",
          qualite: "Premier ministre",
          intitule: "Premier ministre",
          intituleCourt: "Premier ministre",
        }),
      ],
      "M",
    );
    expect(resultat?.titre).toBe("Premier ministre");
  });

  it("met le portefeuille entre parenthèses dans un titre de page", () => {
    expect(fonctionEnCours([fonction()], "F")?.dansUnTitre).toBe("ministre (Armées)");
  });

  it("accorde la présidence de la République", () => {
    const resultat = fonctionEnCours(
      [fonction({ type: "presidence", qualite: "Présidente", gouvernement: null })],
      "F",
    );
    expect(resultat?.titre).toBe("Présidente de la République");
    expect(resultat?.gouvernement).toBeNull();
  });
});
