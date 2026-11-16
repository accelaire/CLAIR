import type { SearchResult } from "@clair/data";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { commissionDissoute, deputeExemple, scrutinExemple } from "./fixtures.ts";
import { ResultatCard } from "./ResultatCard.tsx";

/** Rend une carte dans sa liste, comme sur la page. */
const carte = (resultat: SearchResult) =>
  renderScreen(
    <ul>
      <ResultatCard resultat={resultat} />
    </ul>,
  );

/** Résultats FICTIFS. */
const lobbyiste: SearchResult = {
  _type: "lobbyiste",
  id: "lob-exemple",
  nom: "Association d'exemple",
  type: "Association",
  secteur: "Jardinage",
};
const dossier: SearchResult = {
  _type: "dossier",
  id: "dos-exemple",
  uid: "DLEXEMPLE1",
  titre: "Texte d'exemple sur les jardins",
  legislature: 17,
  etat: "État inconnu d'exemple",
  procedureLibelle: null,
  loiNumero: "2026-12",
};
const groupe: SearchResult = {
  _type: "groupe",
  id: "grp-exemple",
  slug: "groupe-exemple",
  nom: "GEX",
  nomComplet: "Groupe d'exemple",
  couleur: null,
  chambre: "senat",
  actif: true,
  statsMembresActifs: 12,
};
const sujet: SearchResult = {
  _type: "sujet",
  id: "suj-exemple",
  slug: "sujet-exemple",
  label: "Sujet d'exemple",
  description: null,
  category: "Environnement",
  status: null,
  dossierCount: 1,
  scrutinCount: 3,
};

describe("ResultatCard", () => {
  it("décrit un sénateur sans groupe ni circonscription, par son prénom et son nom", () => {
    const { getByRole, getByText, queryByText } = carte({
      ...deputeExemple,
      _type: "senateur",
      chambre: "senat",
      nomComplet: "",
      groupe: null,
      circonscription: null,
    });
    expect(getByRole("link", { name: "Camille Exemple" })).toHaveAttribute(
      "href",
      "/senateurs/camille-exemple",
    );
    expect(getByText("Sénateur")).toBeInTheDocument();
    expect(queryByText("1re circonscription")).toBeNull();
  });

  it("donne la circonscription sans département quand il manque", () => {
    const { getByText } = carte({ ...deputeExemple, departement: null });
    expect(getByText("1re circonscription")).toBeInTheDocument();
  });

  it("écrit un sort de scrutin inconnu tel quel", () => {
    if (scrutinExemple._type !== "scrutin") throw new Error("fixture inattendue");
    const { getByText } = carte({ ...scrutinExemple, sort: "sort d'exemple" });
    expect(getByText("sort d'exemple")).toBeInTheDocument();
  });

  it("décrit un lobbyiste par son type et son secteur", () => {
    expect(carte(lobbyiste).getByText("Association · Jardinage")).toBeInTheDocument();
  });

  it("ne décrit pas un lobbyiste sans type ni secteur", () => {
    const { getByRole } = carte({ ...lobbyiste, type: null, secteur: null });
    expect(getByRole("listitem")).toHaveTextContent(/^Association d'exempleLobbyiste$/);
  });

  it("décrit un dossier par son état et sa loi", () => {
    const { getByRole, getByText } = carte(dossier);
    expect(getByRole("link", { name: /Texte d'exemple sur les jardins/ })).toHaveAttribute(
      "href",
      "/dossiers/DLEXEMPLE1",
    );
    expect(getByText("État inconnu d'exemple")).toBeInTheDocument();
    expect(getByText("Loi n° 2026-12")).toBeInTheDocument();
  });

  it("n'écrit ni état ni loi absents", () => {
    const { queryByText } = carte({ ...dossier, etat: null, loiNumero: null });
    expect(queryByText(/Loi n°/)).toBeNull();
  });

  it("décrit un groupe par son nom complet, sa chambre et ses membres", () => {
    const { getByText } = carte(groupe);
    expect(getByText("Groupe d'exemple · Sénat · 12 membres")).toBeInTheDocument();
    const autre = carte({
      ...groupe,
      nomComplet: "GEX",
      chambre: "assemblee",
      statsMembresActifs: null,
    });
    expect(autre.getByText("Assemblée nationale")).toBeInTheDocument();
  });

  it("nomme une commission active par son nom court, sans type", () => {
    const { getByRole, getByText, queryByText } = carte({
      ...commissionDissoute,
      _type: "commission",
      id: "com-active",
      slug: "com-active",
      nom: "Commission d'exemple",
      nomCourt: "CION-EX",
      chambre: "senat",
      type: null,
      actif: true,
    });
    expect(getByRole("link", { name: "CION-EX" })).toBeInTheDocument();
    expect(getByText("Sénat")).toBeInTheDocument();
    expect(queryByText("Dissoute")).toBeNull();
  });

  it("compte les scrutins et dossiers d'un sujet", () => {
    expect(carte(sujet).getByText("Environnement · 3 scrutins · 1 dossier")).toBeInTheDocument();
  });

  it("ne décrit pas un sujet sans catégorie ni contenu", () => {
    const { getByRole } = carte({ ...sujet, category: null, scrutinCount: 0, dossierCount: 0 });
    expect(getByRole("listitem")).toHaveTextContent(/^Sujet d'exempleSujet$/);
  });
});
