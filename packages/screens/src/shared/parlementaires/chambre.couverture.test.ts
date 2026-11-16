import { describe, expect, it } from "vitest";
import {
  circonscriptionLisible,
  fonctionDe,
  libellePosition,
  libelleSort,
  majuscule,
  positionDeVote,
  scrutinHref,
} from "./chambre.ts";

describe("fonctionDe", () => {
  it("accorde la fonction à la chambre, au sexe et au mandat", () => {
    expect(fonctionDe("senat", "F", true)).toBe("sénatrice");
    expect(fonctionDe("senat", "M", false)).toBe("ancien sénateur");
    expect(fonctionDe("assemblee", "F", false)).toBe("ancienne députée");
    expect(fonctionDe("assemblee", null, true)).toBe("député");
  });
});

describe("scrutinHref", () => {
  it("prend l'Assemblée par défaut et ajoute la session connue", () => {
    expect(scrutinHref({ numero: 3 })).toBe("/scrutins/3?chambre=assemblee");
    expect(scrutinHref({ numero: 3, chambre: "senat", session: "2025" })).toBe(
      "/scrutins/3?chambre=senat&session=2025",
    );
  });
});

describe("positions de vote", () => {
  it("reconnaît les positions, normalise « nonVotant » et refuse l'inconnu", () => {
    expect(positionDeVote(null)).toBeNull();
    expect(positionDeVote("pour")).toBe("pour");
    expect(positionDeVote("nonVotant")).toBe("non_votant");
    expect(positionDeVote("inconnue")).toBeNull();
  });

  it("donne le libellé, ou la valeur brute si elle est inconnue", () => {
    expect(libellePosition("contre")).toBe("Contre");
    expect(libellePosition("bizarre")).toBe("bizarre");
  });
});

describe("libelleSort", () => {
  it("écrit le sort en toutes lettres", () => {
    expect(libelleSort("adopte")).toBe("Adopté");
    expect(libelleSort("Rejeté")).toBe("Rejeté");
    expect(libelleSort("rejet")).toBe("Rejeté");
    expect(libelleSort("retiré")).toBe("retiré");
  });
});

describe("circonscriptionLisible et majuscule", () => {
  it("remplace le nom générique et garde un vrai nom ou une absence", () => {
    expect(circonscriptionLisible({ nom: "99 - Circonscription 2", departement: "99" })).toEqual({
      nom: "Département 99",
      departement: "",
    });
    const nommee = { nom: "Exemple-Nord", departement: "99" };
    expect(circonscriptionLisible(nommee)).toBe(nommee);
    expect(circonscriptionLisible(null)).toBeNull();
  });

  it("met une majuscule initiale", () => {
    expect(majuscule("la loi")).toBe("La loi");
    expect(majuscule("")).toBe("");
  });
});
