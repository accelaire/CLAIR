import "server-only";
import { type ApiClient, ApiError, createHttpClient, type Query } from "@clair/api-client";
import { sansDonneesSource } from "./donnees-source.ts";
import { API_URL } from "./env.ts";
import { internalHeaders } from "./internal-headers.ts";

/**
 * Client de l'API pour les routes (rendu serveur, métadonnées, sitemap) : secret interne et
 * cache de Next (une heure par défaut, la base n'étant réécrite qu'une fois par jour).
 * Toute réponse perd `sourceData`, à toute profondeur (`sansDonneesSource`) : les données lues
 * ici partent dans le HTML dès qu'un écran client les reçoit.
 */
export const serverApi = (revalidate = 3600): ApiClient => {
  const client = createHttpClient({
    baseUrl: `${API_URL}/api/v1`,
    headers: internalHeaders("CLAIR-Site-SSR/1.0"),
    init: { next: { revalidate } },
  });
  return {
    get: async <T>(path: string, query?: Query) =>
      sansDonneesSource(await client.get<T>(path, query)),
  };
};

/**
 * Ressource ou `null` si l'API répond 404 (la page appellera `notFound()`).
 * Toute autre erreur est levée : Next garde alors la version précédente de la page au lieu de
 * mettre en cache un faux 404 (même règle que `fetchRessource` de apps/web).
 */
export const fetchResource = async <T>(path: string, query?: Record<string, string>) => {
  try {
    return await serverApi().get<T>(path, query);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
};

/**
 * Première page d'une liste : `null` si l'API ne répond pas (panne, limite de débit). La page est
 * alors servie et l'écran charge la liste dans le navigateur, comme apps/web, au lieu d'une 500.
 */
export const fetchListe = async <T>(path: string, query?: Record<string, string>) => {
  try {
    return await fetchResource<T>(path, query);
  } catch (error) {
    console.error(`[api-server] ${path} indisponible, chargement dans le navigateur`, error);
    return null;
  }
};
