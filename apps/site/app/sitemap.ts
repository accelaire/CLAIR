import {
  construirePlanDuSite,
  DONNEES_PLAN_VIDES,
  type DonneesPlan,
  type GroupePlan,
} from "@clair/screens";
import type { MetadataRoute } from "next";
import { serverApi } from "@/lib/api-server.ts";
import { SITE_URL } from "@/lib/env.ts";

/**
 * Plan du site (`/sitemap.xml`), repris de apps/web ; la construction est dans
 * `construirePlanDuSite` (`@clair/screens`, testée).
 *
 * Régime : prérendu, puis régénéré au plus une fois par heure (ISR). Une heure plutôt que les
 * 24 h de apps/web : si le build n'a pas joint l'API, le plan réduit aux pages statiques qu'il a
 * produit est remplacé dans l'heure, au lieu de rester figé une journée. L'appel principal
 * (`/api/v1/sitemap`, ~2,5 Mo) n'a lieu qu'à chaque régénération.
 *
 * API injoignable :
 * - au build, le plan se réduit aux pages statiques et l'échec est journalisé : le build ne
 *   dépend pas de l'API (même règle que les listes du site) ;
 * - à la régénération, l'erreur est levée : Next continue de servir le dernier plan complet, qui
 *   vieillit au lieu de se vider (règle de apps/web, qui protégeait ~29 000 adresses).
 */
export const revalidate = 3600;

/** Le gros appel du plan ne doit pas faire échouer la fonction de régénération par délai. */
export const maxDuration = 60;

const AU_BUILD = process.env.NEXT_PHASE === "phase-production-build";

/**
 * Même durée que la page. La réponse du plan dépasse la limite de 2 Mo du cache de `fetch` (Next
 * l'écarte avec un avertissement) : c'est le plan rendu, en ISR, qui est mis en cache.
 */
const api = () => serverApi(revalidate);

const chargerDonnees = async (): Promise<DonneesPlan> => {
  try {
    const data = await api().get<Partial<DonneesPlan>>("/sitemap");
    return { ...DONNEES_PLAN_VIDES, ...data };
  } catch (error) {
    if (!AU_BUILD) throw error;
    console.error("[sitemap] API injoignable au build : plan réduit aux pages statiques", error);
    return DONNEES_PLAN_VIDES;
  }
};

/** Quelques dizaines d'adresses : un échec les omet sans renoncer au reste du plan. */
const facultatif = async <T>(
  chemin: string,
  query: Record<string, string>,
  lire: (corps: unknown) => T[],
): Promise<T[]> => {
  try {
    return lire(await api().get<unknown>(chemin, query));
  } catch (error) {
    console.error(`[sitemap] ${chemin} indisponible, adresses omises`, error);
    return [];
  }
};

const donneesDe = (corps: unknown): unknown[] => {
  if (typeof corps !== "object" || corps === null || !("data" in corps)) return [];
  return Array.isArray(corps.data) ? corps.data : [];
};

const estGroupe = (valeur: unknown): valeur is GroupePlan =>
  typeof valeur === "object" &&
  valeur !== null &&
  "slug" in valeur &&
  typeof valeur.slug === "string" &&
  "chambre" in valeur &&
  typeof valeur.chambre === "string";

const slugDe = (valeur: unknown) =>
  typeof valeur === "object" &&
  valeur !== null &&
  "slug" in valeur &&
  typeof valeur.slug === "string"
    ? [valeur.slug]
    : [];

const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const [data, groupes, elusProvisoires] = await Promise.all([
    chargerDonnees(),
    // Les groupes de la période courante, par leur liste publique (logique non dupliquée).
    facultatif("/groupes", { page: "1", limit: "100" }, (corps) =>
      donneesDe(corps).filter(estGroupe),
    ),
    // Élus du 27 septembre 2026 dont la fiche du Sénat n'existe pas encore.
    facultatif("/senatoriales/2026/elus", {}, (corps) => donneesDe(corps).flatMap(slugDe)),
  ]);
  return construirePlanDuSite({
    base: SITE_URL,
    data,
    groupes,
    elusProvisoires,
    maintenant: new Date().toISOString(),
  });
};

export default sitemap;
