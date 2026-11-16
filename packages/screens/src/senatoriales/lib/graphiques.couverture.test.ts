import type { GroupeRepartition, Sortant } from "@clair/data";
import { describe, expect, it } from "vitest";
import { sortantsExemple } from "../fixtures.ts";
import {
  ageA,
  bandesBilan,
  COULEUR_HORS_SERIE,
  COULEUR_HORS_SERIE_SOMBRE,
  classeCarte,
  couleurCarte,
  estMetropole,
  estSlugGraphique,
  extremesBilan,
  familleProfession,
  mediane,
  parCommission,
  parFamilleProfession,
  partsRemisesEnJeu,
  pointsActivite,
  pointsDistribution,
  pyramideAges,
  RAMPE_CARTE,
  repartitionParGroupe,
  SANS_COMMISSION,
  SANS_PROFESSION,
  siegesParDepartement,
} from "./graphiques.ts";

// Sortants fictifs dérivés des fixtures.
const base = sortantsExemple[0] as Sortant;
const variante = (id: string, extra: Partial<Sortant> = {}): Sortant => ({
  ...base,
  mandatId: `mandat-${id}`,
  personne: { ...base.personne, id, slug: `slug-${id}`, prenom: "Prénom", nom: `Nom${id}` },
  ...extra,
});
const avecPersonne = (id: string, personne: Partial<Sortant["personne"]>): Sortant => {
  const s = variante(id);
  return { ...s, personne: { ...s.personne, ...personne } };
};
const avecBilan = (id: string, bilan: Partial<Sortant["bilan"]>): Sortant => ({
  ...variante(id),
  bilan: { ...base.bilan, ...bilan },
});

describe("estSlugGraphique", () => {
  it("accepte un slug connu et refuse les clés du prototype", () => {
    expect(estSlugGraphique("carte")).toBe(true);
    expect(estSlugGraphique("toString")).toBe(false);
    expect(estSlugGraphique("inconnu")).toBe(false);
  });
});

describe("carte des départements", () => {
  it("compte les sièges par département, ignore les sortants sans circonscription", () => {
    const sieges = siegesParDepartement([
      ...sortantsExemple,
      variante("x", { circonscription: null }),
    ]);
    expect(sieges).toEqual([
      { code: "01", nom: "Ain", sieges: 2 },
      { code: "33", nom: "Gironde", sieges: 1 },
    ]);
  });

  it("distingue la métropole de l'outre-mer", () => {
    expect(estMetropole("33")).toBe(true);
    expect(estMetropole("2A")).toBe(true);
    expect(estMetropole("987")).toBe(false);
  });

  it("classe les valeurs dans la rampe", () => {
    expect(classeCarte(0, 8)).toBe(-1);
    expect(classeCarte(1, 1)).toBe(RAMPE_CARTE.length - 1);
    expect(classeCarte(1, 8)).toBe(0);
    expect(classeCarte(8, 8)).toBe(RAMPE_CARTE.length - 1);
  });

  it("colore hors série en clair ou en sombre", () => {
    expect(couleurCarte(0, 8)).toBe(COULEUR_HORS_SERIE);
    expect(couleurCarte(0, 8, true)).toBe(COULEUR_HORS_SERIE_SOMBRE);
    expect(couleurCarte(8, 8)).toBe(RAMPE_CARTE[4]);
    expect(couleurCarte(1, 8)).toBe(RAMPE_CARTE[0]);
  });
});

describe("groupes", () => {
  const reference: GroupeRepartition[] = [
    {
      slug: "groupe-exemple-a",
      nom: "Groupe Exemple A",
      nomComplet: null,
      couleur: null,
      position: null,
      sieges: 2,
      siegesSenat: 10,
    },
  ];

  it("recompte la sélection, garde l'effectif du Sénat et regroupe les sans-groupe", () => {
    const repartition = repartitionParGroupe(sortantsExemple, reference);
    expect(repartition).toEqual([
      expect.objectContaining({ slug: "groupe-exemple-a", sieges: 2, siegesSenat: 10 }),
      expect.objectContaining({
        slug: "sans-groupe",
        nom: "Sans groupe",
        nomComplet: null,
        couleur: null,
        position: null,
        sieges: 1,
        siegesSenat: undefined,
      }),
    ]);
  });

  it("trie par part remise en jeu, puis sièges, puis nom", () => {
    const groupe = (slug: string, sieges: number, siegesSenat?: number): GroupeRepartition => ({
      slug,
      nom: slug,
      nomComplet: null,
      couleur: null,
      position: null,
      sieges,
      siegesSenat,
    });
    const parts = partsRemisesEnJeu([
      groupe("b", 1, 10),
      groupe("a", 1, 10),
      groupe("c", 2, 20),
      groupe("d", 3),
      groupe("e", 0, 0),
    ]);
    expect(parts.map((p) => [p.slug, p.part])).toEqual([
      ["d", 100],
      ["c", 10],
      ["a", 10],
      ["b", 10],
      ["e", 0],
    ]);
    expect(parts[0]?.siegesSenat).toBe(3);
  });
});

describe("distributions", () => {
  it("écarte les valeurs absentes et trie par valeur croissante", () => {
    const points = pointsDistribution(sortantsExemple, "loyaute");
    expect(points).toHaveLength(2);
    const presence = pointsDistribution(sortantsExemple, "presence");
    expect(presence[0]).toEqual(
      expect.objectContaining({ nom: "Camille Fictif", valeur: 45, couleur: null }),
    );
    expect(presence[0]?.groupe).toBe("Sans groupe");
    expect(presence[1]?.groupe).toBe("Groupe Exemple A");
  });

  it("calcule la médiane d'une série vide, impaire ou paire", () => {
    expect(mediane([])).toBeNull();
    expect(mediane([1, 2, 3])).toBe(2);
    expect(mediane([1, 2, 3, 5])).toBe(2.5);
  });

  it("répartit dans les bandes, borne haute de la dernière comprise", () => {
    const sortants = [
      avecBilan("a", { presence: 100 }),
      avecBilan("b", { presence: 99 }),
      avecBilan("c", { presence: 10 }),
      avecBilan("d", { presence: 50 }),
      avecBilan("e", { presence: null }),
    ];
    const bandes = bandesBilan(sortants, "presence");
    expect(bandes.map((b) => b.effectif)).toEqual([1, 1, 0, 0, 0, 0, 2]);
  });

  it("nomme les plus bas, cinq par défaut ou le nombre demandé", () => {
    const sortants = Array.from({ length: 7 }, (_, i) => avecBilan(String(i), { presence: i }));
    expect(extremesBilan(sortants, "presence")).toHaveLength(5);
    expect(extremesBilan(sortants, "presence", 2).map((p) => p.valeur)).toEqual([0, 1]);
  });
});

describe("activité", () => {
  it("ramène au mois de mandat et écarte les mandats vides ou sans statistique", () => {
    const sansStat = avecBilan("s", { interventions: null, amendements: null });
    const sansDuree: Sortant = { ...variante("d"), mandat: { ...base.mandat, dureeMois: 0 } };
    const partiel: Sortant = {
      ...avecBilan("p", { interventions: null, amendements: 20 }),
      groupe: null,
      mandat: { ...base.mandat, dureeMois: 10 },
    };
    const autre: Sortant = {
      ...avecBilan("q", { interventions: 30, amendements: null }),
      mandat: { ...base.mandat, dureeMois: 10 },
    };
    const points = pointsActivite([sansStat, sansDuree, partiel, autre]);
    expect(points).toEqual([
      expect.objectContaining({
        mandatId: "mandat-p",
        interventions: 0,
        amendements: 2,
        couleur: null,
        groupe: "Sans groupe",
      }),
      expect.objectContaining({
        mandatId: "mandat-q",
        interventions: 3,
        amendements: 0,
        couleur: "#3d6fb4",
      }),
    ]);
  });
});

describe("pyramide des âges", () => {
  const scrutin = new Date("2026-09-27T00:00:00Z");

  it("calcule l'âge révolu, anniversaire passé ou à venir", () => {
    expect(ageA("1960-05-12", scrutin)).toBe(66);
    expect(ageA("1960-12-01", scrutin)).toBe(65);
    expect(ageA("1960-09-28", scrutin)).toBe(65);
    expect(ageA("1960-09-27", scrutin)).toBe(66);
  });

  it("rend une pyramide vide sans date de naissance exploitable", () => {
    expect(pyramideAges([], scrutin)).toEqual([]);
    expect(
      pyramideAges(
        [
          avecPersonne("a", { dateNaissance: null }),
          avecPersonne("b", { dateNaissance: "pas une date" }),
        ],
        scrutin,
      ),
    ).toEqual([]);
  });

  it("compte hommes, femmes et autres et garde les tranches vides intercalées", () => {
    const tranches = pyramideAges(
      [
        avecPersonne("h", { dateNaissance: "1960-01-01", sexe: "M" }),
        avecPersonne("f", { dateNaissance: "1961-01-01", sexe: "F" }),
        avecPersonne("x", { dateNaissance: "1975-01-01", sexe: null }),
      ],
      scrutin,
    );
    expect(tranches.map((t) => t.label)).toEqual(["65–69", "60–64", "55–59", "50–54"]);
    expect(tranches[0]).toEqual(expect.objectContaining({ hommes: 1, femmes: 1, autres: 0 }));
    expect(tranches[1]).toEqual(expect.objectContaining({ hommes: 0, femmes: 0, autres: 0 }));
    expect(tranches[3]).toEqual(expect.objectContaining({ autres: 1 }));
  });
});

describe("comptages", () => {
  it("compte par commission, sans commission compris, avec départage stable", () => {
    const comptage = parCommission([
      ...sortantsExemple,
      variante("a", { commissionPermanente: null }),
      variante("b", { commissionPermanente: "Autre commission" }),
    ]);
    expect(comptage).toEqual([
      { label: "Commission fictive des exemples", valeur: 3 },
      { label: "Autre commission", valeur: 1 },
      { label: SANS_COMMISSION, valeur: 1 },
    ]);
  });

  it("extrait la famille d'une catégorie professionnelle", () => {
    expect(familleProfession(null)).toBeNull();
    expect(familleProfession("   ")).toBeNull();
    expect(familleProfession("Salariés (Cadres divers)")).toBe("Salariés");
    expect(familleProfession(" Agriculteurs ")).toBe("Agriculteurs");
    expect(familleProfession(" (Sans famille)")).toBe("(Sans famille)");
  });

  it("compte par famille professionnelle, non renseignée comprise", () => {
    const comptage = parFamilleProfession([
      ...sortantsExemple,
      avecPersonne("n", { profession: null }),
    ]);
    expect(comptage).toEqual([
      { label: "Salariés", valeur: 2 },
      { label: SANS_PROFESSION, valeur: 1 },
      { label: "Professions libérales", valeur: 1 },
    ]);
  });
});
