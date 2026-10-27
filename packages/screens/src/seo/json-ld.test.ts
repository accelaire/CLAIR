import { describe, expect, it } from "vitest";
import { ficheExemple } from "../parlementaire-fiche/fixtures.ts";
import {
  filArianeJsonLd,
  groupeJsonLd,
  lobbyisteJsonLd,
  parlementaireJsonLd,
  scrutinJsonLd,
  serialiserJsonLd,
  siteWebJsonLd,
} from "./json-ld.ts";

const BASE = "https://clair.vote";

describe("parlementaireJsonLd", () => {
  it("décrit une députée en exercice, avec son emploi et son groupe", () => {
    const data = parlementaireJsonLd(
      BASE,
      { ...ficheExemple, twitter: "@camille", siteWeb: "https://exemple.org" },
      "assemblee",
    );
    expect(data).toMatchObject({
      "@type": "Person",
      name: "Camille Exemple",
      url: `${BASE}/deputes/${ficheExemple.slug}`,
      jobTitle: "Députée",
      worksFor: { "@type": "Organization" },
      description: "Députée de 99 - Circonscription 2 (99)",
      sameAs: ["https://x.com/camille", "https://exemple.org"],
    });
  });

  it("n'attribue ni emploi ni employeur à une ancienne sénatrice", () => {
    const data = parlementaireJsonLd(BASE, { ...ficheExemple, actif: false }, "senat");
    expect(data.jobTitle).toBeUndefined();
    expect(data.worksFor).toBeUndefined();
    expect(data.url).toBe(`${BASE}/senateurs/${ficheExemple.slug}`);
    expect(data.description).toMatch(/^Ancienne sénatrice de /);
  });
});

describe("scrutinJsonLd", () => {
  it("situe un scrutin du Sénat au Sénat et donne son résultat", () => {
    const data = scrutinJsonLd(
      {
        numero: 54,
        titre: "Ensemble du projet de loi",
        chambre: "senat",
        date: "2026-03-12",
        sort: "adopté",
        nombrePour: 200,
        nombreContre: 100,
        nombreAbstention: 10,
      },
      `${BASE}/scrutins/54?chambre=senat&session=2025`,
    );
    expect(data.organizer).toMatchObject({ name: "Sénat" });
    expect(data.additionalProperty).toContainEqual(
      expect.objectContaining({ name: "result", value: "Adopté" }),
    );
  });
});

describe("autres données structurées", () => {
  it("ajoute l'accueil en tête du fil d'Ariane, en adresses absolues", () => {
    const data = filArianeJsonLd(BASE, [{ nom: "Députés", chemin: "/deputes" }]);
    expect(data.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
      { "@type": "ListItem", position: 2, name: "Députés", item: `${BASE}/deputes` },
    ]);
  });

  it("décrit groupe, lobbyiste et recherche du site", () => {
    expect(
      groupeJsonLd(BASE, {
        chambre: "assemblee",
        slug: "exe",
        nom: "EXE",
        nomComplet: "Groupe exemple",
        logoUrl: null,
        membresActifsCount: 12,
      }),
    ).toMatchObject({
      name: "Groupe exemple",
      alternateName: "EXE",
      memberOf: { name: "Assemblée nationale" },
    });
    expect(
      lobbyisteJsonLd(BASE, { id: "x", nom: "Org", secteur: null, ville: "Lyon", nbLobbyistes: 3 }),
    ).toMatchObject({ address: { addressLocality: "Lyon" }, numberOfEmployees: { value: 3 } });
    expect(siteWebJsonLd(BASE)).toMatchObject({
      potentialAction: { target: { urlTemplate: `${BASE}/recherche?q={search_term_string}` } },
    });
  });
});

describe("serialiserJsonLd", () => {
  it("ne laisse jamais une donnée fermer la balise script, et reste du JSON valide", () => {
    const texte = serialiserJsonLd({ name: "</script><script>alert(1)</script> & co" });
    expect(texte).not.toContain("<");
    expect(JSON.parse(texte)).toEqual({ name: "</script><script>alert(1)</script> & co" });
  });
});
