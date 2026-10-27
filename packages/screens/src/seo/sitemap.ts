/**
 * Construction du plan du site (`/sitemap.xml`), reprise de `app/sitemap.ts` de apps/web.
 *
 * Fonction pure : la route charge les données (`/api/v1/sitemap`, les groupes et les élus
 * provisoires des sénatoriales), puis appelle `construirePlanDuSite`. Sans données (API
 * injoignable), le plan se réduit aux pages statiques.
 *
 * Règle des dates (`lastModified`) : une page n'en porte une que si elle est vraie. Les listes
 * prennent la date de la dernière ingestion ; les pages outils n'en ont aucune ; une fiche de
 * personne ne prend jamais `updatedAt`, que la synchronisation nocturne réécrit sur chaque ligne.
 */

import { SLUGS_DEPARTEMENTS } from "../senatoriales/lib/departements.ts";
import { SLUGS_GRAPHIQUES } from "../senatoriales/lib/graphiques.ts";
import { scrutinHref } from "../shared/scrutins.ts";

/** Fréquences de `<changefreq>` (mêmes valeurs que `MetadataRoute.Sitemap` de Next). */
export type Frequence = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

/** Entrée du plan, compatible avec `MetadataRoute.Sitemap` de Next. */
export type EntreePlan = {
  url: string;
  lastModified?: string;
  changeFrequency?: Frequence;
  priority?: number;
};

type Parlementaire = {
  slug: string;
  updatedAt?: string;
  /** Date du dernier changement réel de la fiche (dernier scrutin ou génération IA), calculée par l'API. */
  lastModified?: string | null;
};

type Scrutin = { numero: number; chambre: string; session: string | null; date: string };

/** Réponse de `/api/v1/sitemap` (champs absents tolérés). */
export type DonneesPlan = {
  deputes: Parlementaire[];
  senateurs: Parlementaire[];
  scrutins: Scrutin[];
  lobbyistes: { id: string; updatedAt?: string }[];
  dossiers: { uid: string; dateDepot?: string }[];
  sujets: { slug: string; updatedAt?: string }[];
};

export type GroupePlan = { slug: string; chambre: string; updatedAt?: string };

export const DONNEES_PLAN_VIDES: DonneesPlan = {
  deputes: [],
  senateurs: [],
  scrutins: [],
  lobbyistes: [],
  dossiers: [],
  sujets: [],
};

/**
 * Adresses des pages des sénatoriales : les mêmes listes que les routes
 * `/senatoriales-2026/[departement]` et `/senatoriales-2026/graphiques/[slug]`, une seule source.
 */
export const SLUGS_DEPARTEMENTS_SENATORIALES: readonly string[] = SLUGS_DEPARTEMENTS;
export const SLUGS_GRAPHIQUES_SENATORIALES: readonly string[] = SLUGS_GRAPHIQUES;

/**
 * Échappe les caractères réservés de XML : Next (16 compris) écrit `<loc>` tel quel, et les
 * adresses de scrutin portent un `&` (`?chambre=…&session=…`). Sans échappement, le plan n'est
 * pas du XML valide et les moteurs le rejettent en entier. Une entité déjà présente n'est pas
 * doublée.
 */
export const echapperUrlXml = (url: string) =>
  url
    .replace(/&(?!(?:amp|lt|gt|quot|apos);)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** Date de la dernière ingestion, déduite des données ; `repli` s'il n'y en a aucune. */
export const derniereIngestion = (data: DonneesPlan, repli: string) => {
  const dates = [
    ...data.deputes.map((d) => d.updatedAt),
    ...data.senateurs.map((s) => s.updatedAt),
    ...data.sujets.map((s) => s.updatedAt),
    ...data.lobbyistes.map((l) => l.updatedAt),
  ].filter((d): d is string => typeof d === "string" && d.length > 0);
  // Dates ISO : l'ordre alphabétique est l'ordre chronologique.
  return dates.sort().at(-1) ?? repli;
};

/** Date du scrutin le plus récent d'une période d'archive (`2025` ou `2025/03`). */
const finDePeriode = (scrutins: Scrutin[], prefixe: string) => {
  let max: string | null = null;
  for (const s of scrutins) {
    if (typeof s.date !== "string") continue;
    const cle = prefixe.length === 4 ? s.date.slice(0, 4) : s.date.slice(0, 7).replace("-", "/");
    if (cle === prefixe && (!max || s.date > max)) max = s.date;
  }
  return max;
};

/** Années et mois d'archive qui ont au moins un scrutin (pas de page vide dans le plan). */
const periodesArchive = (scrutins: Scrutin[]) => {
  const annees = new Set<string>();
  const mois = new Set<string>();
  for (const s of scrutins) {
    if (typeof s.date !== "string") continue;
    const annee = s.date.slice(0, 4);
    const mm = s.date.slice(5, 7);
    if (!/^\d{4}$/.test(annee) || !/^\d{2}$/.test(mm)) continue;
    annees.add(annee);
    mois.add(`${annee}/${mm}`);
  }
  return { annees: [...annees], mois: [...mois] };
};

export type EntreesPlan = {
  /** Adresse publique du site, sans barre finale (`https://clair.vote`). */
  base: string;
  data: DonneesPlan;
  groupes: GroupePlan[];
  /** Slugs des sénateurs élus en 2026 qui ont une fiche provisoire. */
  elusProvisoires: string[];
  /** Horodatage de repli pour la dernière ingestion (maintenant). */
  maintenant: string;
};

/** Plan complet du site, adresses échappées pour XML. */
export const construirePlanDuSite = ({
  base,
  data,
  groupes,
  elusProvisoires,
  maintenant,
}: EntreesPlan): EntreePlan[] => {
  const url = (chemin: string) => `${base}${chemin}`;
  const ingestion = derniereIngestion(data, maintenant);
  const liste = (chemin: string, changeFrequency: Frequence, priority: number): EntreePlan => ({
    url: url(chemin),
    lastModified: ingestion,
    changeFrequency,
    priority,
  });
  const outil = (chemin: string, changeFrequency: Frequence, priority: number): EntreePlan => ({
    url: url(chemin),
    changeFrequency,
    priority,
  });
  // Une fiche provisoire s'efface devant la définitive : jamais deux entrées pour une adresse.
  const slugsSenateurs = new Set(data.senateurs.map((s) => s.slug));

  const statiques: EntreePlan[] = [
    liste("", "daily", 1),
    liste("/deputes", "daily", 0.9),
    liste("/senateurs", "daily", 0.9),
    liste("/scrutins", "daily", 0.9),
    liste("/votes", "monthly", 0.8),
    liste("/lobbying", "weekly", 0.8),
    liste("/lobbying/actions", "weekly", 0.7),
    liste("/groupes", "weekly", 0.8),
    outil("/recherche", "weekly", 0.7),
    outil("/explorateur", "weekly", 0.7),
    liste("/senatoriales-2026", "daily", 0.9),
    // Les circonscriptions portent la requête réellement tapée (« Gironde sénatoriales 2026 ») :
    // même priorité que la page mère.
    ...SLUGS_DEPARTEMENTS_SENATORIALES.map((slug) =>
      liste(`/senatoriales-2026/${slug}`, "daily", 0.9),
    ),
    // Chaque graphique a sa propre image de partage : indexable, un cran sous la page mère.
    ...SLUGS_GRAPHIQUES_SENATORIALES.map((slug) =>
      liste(`/senatoriales-2026/graphiques/${slug}`, "daily", 0.7),
    ),
    ...elusProvisoires
      .filter((slug) => !slugsSenateurs.has(slug))
      .map((slug) => liste(`/senateurs/${slug}`, "daily", 0.8)),
    liste("/classements", "daily", 0.9),
    outil("/soutenir", "monthly", 0.5),
    outil("/deputes/comparer", "weekly", 0.6),
    outil("/senateurs/comparer", "weekly", 0.6),
    liste("/dossiers", "daily", 0.9),
    liste("/sujets", "weekly", 0.8),
  ];

  const parlementaire =
    (chemin: string) =>
    (p: Parlementaire): EntreePlan => ({
      url: url(`${chemin}/${p.slug}`),
      ...(p.lastModified ? { lastModified: p.lastModified } : {}),
      changeFrequency: "weekly",
      priority: 0.8,
    });

  const { annees, mois } = periodesArchive(data.scrutins);

  return [
    ...statiques,
    ...data.deputes.map(parlementaire("/deputes")),
    ...data.senateurs.map(parlementaire("/senateurs")),
    // Le numéro n'est unique dans aucune chambre : l'adresse porte la chambre et la session.
    ...data.scrutins.map(
      (s): EntreePlan => ({
        url: url(scrutinHref(s)),
        lastModified: s.date,
        changeFrequency: "monthly",
        priority: 0.7,
      }),
    ),
    // Une année révolue ne bouge plus : sa date est celle de son dernier scrutin.
    ...annees.map(
      (annee): EntreePlan => ({
        url: url(`/votes/${annee}`),
        lastModified: finDePeriode(data.scrutins, annee) ?? ingestion,
        changeFrequency: "monthly",
        priority: 0.6,
      }),
    ),
    ...mois.map(
      (cle): EntreePlan => ({
        url: url(`/votes/${cle}`),
        lastModified: finDePeriode(data.scrutins, cle) ?? ingestion,
        changeFrequency: "monthly",
        priority: 0.5,
      }),
    ),
    // Lobbyistes : sans date, faute d'une date de contenu fiable.
    ...data.lobbyistes.map(
      (l): EntreePlan => ({
        url: url(`/lobbying/${l.id}`),
        changeFrequency: "monthly",
        priority: 0.6,
      }),
    ),
    ...groupes.map(
      (g): EntreePlan => ({
        url: url(`/groupes/${g.chambre}/${g.slug}`),
        ...(g.updatedAt ? { lastModified: g.updatedAt } : {}),
        changeFrequency: "weekly",
        priority: 0.7,
      }),
    ),
    ...data.dossiers.map(
      (d): EntreePlan => ({
        url: url(`/dossiers/${d.uid}`),
        ...(d.dateDepot ? { lastModified: d.dateDepot } : {}),
        changeFrequency: "weekly",
        priority: 0.7,
      }),
    ),
    ...data.sujets.map(
      (s): EntreePlan => ({
        url: url(`/sujets/${s.slug}`),
        ...(s.updatedAt ? { lastModified: s.updatedAt } : {}),
        changeFrequency: "weekly",
        priority: 0.7,
      }),
    ),
  ].map((entree) => ({ ...entree, url: echapperUrlXml(entree.url) }));
};
