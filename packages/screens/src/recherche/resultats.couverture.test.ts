import type { SearchParlementaire, SearchResult } from "@clair/data";
import { describe, expect, it } from "vitest";
import { ancienneDeputee, deputeExemple } from "./fixtures.ts";
import {
  categorieDe,
  cleDe,
  compte,
  libelleAncien,
  libelleTypeCommission,
  lienDe,
} from "./resultats.ts";

/** Résultats FICTIFS, un par type. */
const lobbyiste: SearchResult = {
  _type: "lobbyiste",
  id: "lob-exemple",
  nom: "Association d'exemple",
  type: null,
  secteur: null,
};
const dossier: SearchResult = {
  _type: "dossier",
  id: "dos-exemple",
  uid: "DLEXEMPLE1",
  titre: "Texte d'exemple",
  legislature: 17,
  etat: null,
  procedureLibelle: null,
  loiNumero: null,
};
const groupe: SearchResult = {
  _type: "groupe",
  id: "grp-exemple",
  slug: "groupe-exemple",
  nom: "GEX",
  nomComplet: null,
  couleur: null,
  chambre: "senat",
  actif: true,
  statsMembresActifs: null,
};
const commission: SearchResult = {
  _type: "commission",
  id: "com-exemple",
  slug: "commission-exemple",
  nom: "Commission d'exemple",
  nomCourt: null,
  chambre: "assemblee",
  type: null,
  actif: true,
};
const sujet: SearchResult = {
  _type: "sujet",
  id: "suj-exemple",
  slug: "sujet-exemple",
  label: "Sujet d'exemple",
  description: null,
  category: null,
  status: null,
  dossierCount: 0,
  scrutinCount: 0,
};
const senateur: SearchParlementaire = { ...deputeExemple, _type: "senateur", chambre: "senat" };

describe("categorieDe", () => {
  it("range chaque type dans sa catégorie", () => {
    expect(categorieDe(deputeExemple)).toBe("deputes");
    expect(categorieDe(senateur)).toBe("senateurs");
    expect(categorieDe(lobbyiste)).toBe("lobbyistes");
    expect(categorieDe(dossier)).toBe("dossiers");
    expect(categorieDe(groupe)).toBe("groupes");
    expect(categorieDe(commission)).toBe("commissions");
    expect(categorieDe(sujet)).toBe("sujets");
  });
});

describe("lienDe", () => {
  it("mène à la fiche de chaque type", () => {
    expect(lienDe(deputeExemple)).toBe("/deputes/camille-exemple");
    expect(lienDe(senateur)).toBe("/senateurs/camille-exemple");
    expect(lienDe(lobbyiste)).toBe("/lobbying/lob-exemple");
    expect(lienDe(dossier)).toBe("/dossiers/DLEXEMPLE1");
    expect(lienDe(groupe)).toBe("/groupes/senat/groupe-exemple");
    expect(lienDe(commission)).toBe("/commissions/commission-exemple");
    expect(lienDe(sujet)).toBe("/sujets/sujet-exemple");
  });

  it("range un groupe sans chambre à l'Assemblée", () => {
    expect(lienDe({ ...groupe, chambre: "" })).toBe("/groupes/assemblee/groupe-exemple");
  });

  it("donne une clé stable par type et identifiant", () => {
    expect(cleDe(sujet)).toBe("sujet-suj-exemple");
  });
});

describe("libelleAncien", () => {
  const mandatSenat = {
    chambre: "senat",
    legislature: null,
    mandature: null,
    dateDebut: "2017-10-01T00:00:00.000Z",
    dateFin: "2023-09-30T00:00:00.000Z",
  };

  it("accorde le titre au genre et à la chambre", () => {
    expect(libelleAncien({ ...ancienneDeputee, dernierMandat: null })).toBe("Ancienne députée");
    expect(libelleAncien({ ...ancienneDeputee, chambre: "senat", dernierMandat: null })).toBe(
      "Ancienne sénatrice",
    );
    expect(libelleAncien({ ...ancienneDeputee, sexe: "M", dernierMandat: null })).toBe(
      "Ancien député",
    );
    expect(
      libelleAncien({ ...ancienneDeputee, sexe: "M", chambre: "senat", dernierMandat: null }),
    ).toBe("Ancien sénateur");
    expect(libelleAncien({ ...ancienneDeputee, sexe: null, dernierMandat: null })).toBe(
      "Mandat clos",
    );
  });

  it("date un mandat de l'Assemblée par sa législature", () => {
    expect(libelleAncien(ancienneDeputee)).toBe("Ancienne députée · XVIe législature");
  });

  it("date un mandat du Sénat par son année de fin", () => {
    expect(
      libelleAncien({ ...ancienneDeputee, chambre: "senat", dernierMandat: mandatSenat }),
    ).toBe("Ancienne sénatrice · jusqu'en 2023");
  });

  it("se contente du titre sans date exploitable", () => {
    expect(
      libelleAncien({ ...ancienneDeputee, dernierMandat: { ...mandatSenat, dateFin: null } }),
    ).toBe("Ancienne députée");
    expect(
      libelleAncien({
        ...ancienneDeputee,
        dernierMandat: { ...mandatSenat, dateFin: "date illisible" },
      }),
    ).toBe("Ancienne députée");
  });
});

describe("libelleTypeCommission et compte", () => {
  it("reprend le libellé connu, rend lisible un type inconnu", () => {
    expect(libelleTypeCommission("enquete")).toBe("Commission d'enquête");
    expect(libelleTypeCommission("groupe_de_travail_x")).toBe("Groupe de travail x");
  });

  it("accorde le mot au nombre", () => {
    expect(compte(1, "scrutin")).toBe("1 scrutin");
    expect(compte(0, "scrutin")).toBe("0 scrutin");
    expect(compte(12, "scrutin")).toBe("12 scrutins");
  });
});
