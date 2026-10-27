import { describe, expect, it } from "vitest";
import {
  construirePlanDuSite,
  DONNEES_PLAN_VIDES,
  type DonneesPlan,
  echapperUrlXml,
  SLUGS_DEPARTEMENTS_SENATORIALES,
  SLUGS_GRAPHIQUES_SENATORIALES,
} from "./sitemap.ts";

const BASE = "https://clair.vote";
const MAINTENANT = "2026-10-27T04:00:00.000Z";

const plan = (data: Partial<DonneesPlan> = {}, extra: { elus?: string[] } = {}) =>
  construirePlanDuSite({
    base: BASE,
    data: { ...DONNEES_PLAN_VIDES, ...data },
    groupes: [{ slug: "rn", chambre: "assemblee", updatedAt: "2026-10-01" }],
    elusProvisoires: extra.elus ?? [],
    maintenant: MAINTENANT,
  });

const urls = (entrees: { url: string }[]) => entrees.map((e) => e.url);

describe("construirePlanDuSite", () => {
  it("sans données de l'API, garde les pages statiques (accueil, recherche, sénatoriales…)", () => {
    const entrees = plan();
    expect(urls(entrees)).toEqual(
      expect.arrayContaining([
        BASE,
        `${BASE}/recherche`,
        `${BASE}/explorateur`,
        `${BASE}/senatoriales-2026`,
        `${BASE}/senatoriales-2026/gironde`,
        `${BASE}/senatoriales-2026/graphiques/carte`,
        `${BASE}/groupes/assemblee/rn`,
      ]),
    );
    expect(SLUGS_DEPARTEMENTS_SENATORIALES).toHaveLength(64);
    expect(SLUGS_GRAPHIQUES_SENATORIALES).toHaveLength(7);
    // Aucune date inventée : les listes prennent l'horodatage de repli, les outils aucune.
    expect(entrees.find((e) => e.url === BASE)?.lastModified).toBe(MAINTENANT);
    expect(entrees.find((e) => e.url === `${BASE}/recherche`)?.lastModified).toBeUndefined();
  });

  it("échappe le & des adresses de scrutin et crée les archives par année et par mois", () => {
    const entrees = plan({
      scrutins: [
        { numero: 54, chambre: "senat", session: "2025", date: "2026-03-12" },
        { numero: 4000, chambre: "assemblee", session: "17", date: "2025-11-04" },
      ],
    });
    expect(urls(entrees)).toEqual(
      expect.arrayContaining([
        `${BASE}/scrutins/54?chambre=senat&amp;session=2025`,
        `${BASE}/votes/2026`,
        `${BASE}/votes/2026/03`,
        `${BASE}/votes/2025/11`,
      ]),
    );
    expect(entrees.find((e) => e.url === `${BASE}/votes/2026`)?.lastModified).toBe("2026-03-12");
  });

  it("date une fiche par sa date de contenu, jamais par updatedAt", () => {
    const entrees = plan({
      deputes: [
        { slug: "a", updatedAt: "2026-10-27", lastModified: "2026-09-01" },
        { slug: "b", updatedAt: "2026-10-26" },
      ],
    });
    expect(entrees.find((e) => e.url === `${BASE}/deputes/a`)?.lastModified).toBe("2026-09-01");
    expect(entrees.find((e) => e.url === `${BASE}/deputes/b`)?.lastModified).toBeUndefined();
    // La dernière ingestion date les listes.
    expect(entrees.find((e) => e.url === `${BASE}/deputes`)?.lastModified).toBe("2026-10-27");
  });

  it("n'ajoute une fiche provisoire d'élu que si la fiche définitive n'existe pas", () => {
    const entrees = plan(
      { senateurs: [{ slug: "deja-senateur" }] },
      { elus: ["deja-senateur", "nouvel-elu"] },
    );
    const fiches = urls(entrees).filter((u) => u.startsWith(`${BASE}/senateurs/`));
    expect(fiches.filter((u) => u.endsWith("/deja-senateur"))).toHaveLength(1);
    expect(fiches).toContain(`${BASE}/senateurs/nouvel-elu`);
  });
});

describe("echapperUrlXml", () => {
  it("n'échappe pas deux fois une entité", () => {
    expect(echapperUrlXml("/a?b=1&amp;c=2&d=<x>")).toBe("/a?b=1&amp;c=2&amp;d=&lt;x&gt;");
  });
});
