import type { Elu, ResultatsCirconscription, ResultatsNationaux } from "@clair/data";
import { describe, expect, it } from "vitest";
import { resultatsGirondeExemple, resultatsNationauxExemple } from "../fixtures.ts";
import {
  chapeauNational,
  directCirconscription,
  directNational,
  etapesJournee,
  libelleParcours,
  libelleStatut,
  lienElu,
  positionsHemicycle,
  resultatsComplets,
  resultatsPublies,
  scrutinCommence,
} from "./resultats.ts";

// Variantes fictives de la soirée, dérivées des fixtures.
const national = (extra: Partial<ResultatsNationaux> = {}): ResultatsNationaux => ({
  ...resultatsNationauxExemple,
  ...extra,
});
const compteurs = (
  extra: Partial<ResultatsNationaux["compteurs"]>,
): ResultatsNationaux["compteurs"] => ({ ...resultatsNationauxExemple.compteurs, ...extra });
const aucunResultat = compteurs({ pourvue: 0, partielle: 0, second_tour: 0 });

describe("libelleStatut", () => {
  it("donne le libellé de chaque état", () => {
    expect(libelleStatut("pas_ouvert", null)).toBe("Vote pas encore ouvert");
    expect(libelleStatut("vote_en_cours", null)).toBe("Vote en cours");
    expect(libelleStatut("resultats_attendus", null)).toBe("Résultats attendus");
    expect(libelleStatut("partielle", null)).toBe("Résultats partiels");
    expect(libelleStatut("pourvue", null)).toBe("Résultats connus");
  });

  it("précise l'étape du second tour", () => {
    expect(libelleStatut("second_tour", "en_cours")).toBe("2nd tour en cours");
    expect(libelleStatut("second_tour", "clos")).toBe("2nd tour clos, résultats attendus");
    expect(libelleStatut("second_tour", "a_venir")).toBe("2nd tour à venir");
    expect(libelleStatut("second_tour", null)).toBe("2nd tour à venir");
  });
});

describe("lienElu", () => {
  it("renvoie la fiche définitive, Sénat ou Assemblée", () => {
    const personne = { slug: "p", chambre: "senat", actif: true, photoUrl: null };
    expect(lienElu({ personne, slug: null })).toBe("/senateurs/p");
    expect(lienElu({ personne: { ...personne, chambre: "assemblee" }, slug: null })).toBe(
      "/deputes/p",
    );
  });

  it("renvoie la fiche provisoire, ou rien", () => {
    expect(lienElu({ personne: null, slug: "provisoire" })).toBe("/senateurs/provisoire");
    expect(lienElu({ personne: null, slug: null })).toBeNull();
  });
});

describe("libelleParcours", () => {
  const elu = (
    parcours: Elu["parcours"],
    sexe: string | null,
    avant: Elu["avant"] = null,
  ): Pick<Elu, "parcours" | "avant" | "sexe"> => ({ parcours, sexe, avant });

  it("accorde réélu, nouveau, ancien sénateur", () => {
    expect(libelleParcours(elu("reelu", "F"))).toBe("réélue");
    expect(libelleParcours(elu("reelu", "M"))).toBe("réélu");
    expect(libelleParcours(elu("nouveau", "F"))).toBe("nouvelle au Parlement");
    expect(libelleParcours(elu("nouveau", null))).toBe("nouveau au Parlement");
    const senat = { chambre: "senat", enCours: false };
    expect(libelleParcours(elu("parlementaire", "F", senat))).toBe("ancienne sénatrice");
    expect(libelleParcours(elu("parlementaire", "M", senat))).toBe("ancien sénateur");
  });

  it("distingue député en cours et ancien député", () => {
    const enCours = { chambre: "assemblee", enCours: true };
    const passe = { chambre: "assemblee", enCours: false };
    expect(libelleParcours(elu("parlementaire", "F", enCours))).toBe("députée");
    expect(libelleParcours(elu("parlementaire", "M", enCours))).toBe("député");
    expect(libelleParcours(elu("parlementaire", "F", passe))).toBe("ancienne députée");
    expect(libelleParcours(elu("parlementaire", "M", passe))).toBe("ancien député");
  });

  it("se replie sur « nouveau » pour un parlementaire sans mandat connu", () => {
    expect(libelleParcours(elu("parlementaire", "M", null))).toBe("nouveau au Parlement");
  });
});

describe("état de la soirée", () => {
  it("détecte un scrutin commencé", () => {
    expect(scrutinCommence(null)).toBe(false);
    expect(scrutinCommence(undefined)).toBe(false);
    expect(
      scrutinCommence(
        national({
          circonscriptions: resultatsNationauxExemple.circonscriptions.map((c) => ({
            ...c,
            statut: "pas_ouvert",
          })),
        }),
      ),
    ).toBe(false);
    expect(scrutinCommence(resultatsNationauxExemple)).toBe(true);
  });

  it("détecte des résultats publiés et complets", () => {
    expect(resultatsPublies(resultatsNationauxExemple)).toBe(true);
    expect(resultatsPublies(national({ compteurs: aucunResultat }))).toBe(false);
    expect(resultatsComplets(resultatsNationauxExemple)).toBe(false);
    expect(resultatsComplets(national({ compteurs: compteurs({ pourvue: 2 }) }))).toBe(true);
  });

  it("reste en direct tant que tout n'est pas attribué, dans la fenêtre", () => {
    expect(directNational(resultatsNationauxExemple)).toBe(true);
    expect(directNational(null)).toBe(false);
    expect(directNational(national({ compteurs: compteurs({ pourvue: 2 }) }))).toBe(false);
    expect(directNational(national({ maintenant: "2026-09-29T12:00:00+02:00" }))).toBe(false);
  });

  it("met à jour la page d'une circonscription selon son état", () => {
    const circo = (
      statut: ResultatsCirconscription["circonscription"]["statut"],
      maintenant = resultatsGirondeExemple.maintenant,
    ): ResultatsCirconscription => ({
      ...resultatsGirondeExemple,
      maintenant,
      circonscription: { ...resultatsGirondeExemple.circonscription, statut },
    });
    expect(directCirconscription(null)).toBe(false);
    expect(directCirconscription(undefined)).toBe(false);
    expect(directCirconscription(circo("pas_ouvert"))).toBe(false);
    expect(directCirconscription(circo("pourvue"))).toBe(false);
    expect(directCirconscription(circo("partielle"))).toBe(true);
    expect(directCirconscription(circo("partielle", "2026-09-30T12:00:00+02:00"))).toBe(false);
  });
});

describe("chapeauNational", () => {
  it("annonce les sièges attribués quand tout est pourvu", () => {
    expect(chapeauNational(national({ compteurs: compteurs({ pourvue: 2 }) }))).toMatch(
      /^Les 8 sièges remis en jeu sont attribués/,
    );
  });

  it("attend les premiers résultats, avant ou après midi", () => {
    expect(
      chapeauNational(
        national({ compteurs: aucunResultat, maintenant: "2026-09-27T10:00:00+02:00" }),
      ),
    ).toMatch(/^Premiers résultats attendus vers midi/);
    expect(
      chapeauNational(
        national({ compteurs: aucunResultat, maintenant: "2026-09-27T13:00:00+02:00" }),
      ),
    ).toBe("Les résultats du 1er tour au scrutin majoritaire sont attendus.");
  });

  it("annonce la vague du soir, puis l'arrivée circonscription par circonscription", () => {
    expect(chapeauNational(national({ maintenant: "2026-09-27T14:00:00+02:00" }))).toMatch(
      /^Le 1er tour au scrutin majoritaire est connu/,
    );
    expect(chapeauNational(resultatsNationauxExemple)).toMatch(
      /^Les résultats arrivent circonscription par circonscription/,
    );
  });
});

describe("etapesJournee", () => {
  it("met tout à venir avant l'ouverture", () => {
    const etapes = etapesJournee(national({ maintenant: "2026-09-27T00:30:00+02:00" }));
    expect(etapes.map((e) => e.etat)).toEqual([
      "a_venir",
      "a_venir",
      "a_venir",
      "a_venir",
      "a_venir",
      "a_venir",
      "a_venir",
    ]);
  });

  it("suit l'avancement de la soirée", () => {
    const etapes = etapesJournee(resultatsNationauxExemple);
    expect(etapes.map((e) => e.etat)).toEqual([
      "fait",
      "fait",
      "fait",
      "fait",
      "fait",
      "en_cours",
      "a_venir",
    ]);
  });

  it("marque la métropole puis l'outre-mer comme faits", () => {
    const pourvues = resultatsNationauxExemple.circonscriptions.map((c) => ({
      ...c,
      statut: "pourvue" as const,
    }));
    const etapes = etapesJournee(
      national({
        maintenant: "2026-09-27T23:00:00+02:00",
        circonscriptions: pourvues,
        compteurs: compteurs({ pourvue: 2 }),
      }),
    );
    expect(etapes.map((e) => e.etat)).toEqual([
      "fait",
      "fait",
      "fait",
      "fait",
      "fait",
      "fait",
      "fait",
    ]);
  });

  it("ouvre Wallis-et-Futuna dans la nuit, avant 7h30", () => {
    const etapes = etapesJournee(national({ maintenant: "2026-09-27T03:00:00+02:00" }));
    expect(etapes[0]?.etat).toBe("en_cours");
    expect(etapes[1]?.etat).toBe("a_venir");
  });
});

describe("positionsHemicycle", () => {
  it("place chaque siège, de gauche à droite", () => {
    const positions = positionsHemicycle(348, 200, 200, 50, 190);
    expect(positions).toHaveLength(348);
    expect(Math.max(...positions.map((p) => p.row))).toBe(7);
    const angles = positions.map((p) => p.angle);
    expect(angles).toEqual([...angles].sort((a, b) => b - a));
  });

  it("ajoute des rangs pour une grande assemblée", () => {
    expect(Math.max(...positionsHemicycle(450, 0, 0, 10, 100).map((p) => p.row))).toBe(9);
    expect(Math.max(...positionsHemicycle(577, 0, 0, 10, 100).map((p) => p.row))).toBe(11);
  });

  it("place un siège unique sans division par zéro", () => {
    const positions = positionsHemicycle(1, 0, 0, 10, 100);
    expect(positions).toHaveLength(1);
    expect(Number.isFinite(positions[0]?.x)).toBe(true);
  });
});
