import "server-only";
import type {
  ApercuSenatoriales,
  ListeCandidats,
  ListeSortants,
  ResultatsCirconscription,
  ResultatsNationaux,
} from "@clair/data";
import {
  codeDepuisSlug,
  libelleCirconscription,
  type SenatorialesParams,
  sortantsCirconscriptionQuery,
  sortantsQueryOf,
} from "@clair/screens";
import { cache } from "react";
import { fetchListe, fetchResource, serverApi } from "@/lib/api-server.ts";
import { SITE_URL } from "@/lib/env.ts";

/** Adresse absolue d'une page de la rubrique (données structurées, canonique). */
export const urlAbsolue = (chemin: string) => new URL(chemin, SITE_URL).toString();

/**
 * Les résultats du ministère, relus chaque minute (le soir du scrutin, l'ingestion passe toutes
 * les cinq minutes et l'API met ses réponses en cache une minute). `null` si l'API ne répond
 * pas : la page se rend alors sans eux, comme avant le scrutin, plutôt que de tomber.
 */
const resultatsOuNull = async <T>(chemin: string): Promise<T | null> => {
  try {
    return await serverApi(60).get<T>(chemin);
  } catch (error) {
    console.error(`[senatoriales] ${chemin} indisponible, page rendue sans résultats`, error);
    return null;
  }
};

export const chargerResultats = cache(() =>
  resultatsOuNull<ResultatsNationaux>("/senatoriales/2026/resultats"),
);

export const chargerResultatsCirconscription = cache((code: string) =>
  resultatsOuNull<ResultatsCirconscription>(
    `/senatoriales/2026/resultats/${encodeURIComponent(code)}`,
  ),
);

/** Aperçu du renouvellement ; `null` si l'API ne répond pas (l'écran le chargera). */
export const chargerApercu = cache(() => fetchListe<ApercuSenatoriales>("/senatoriales/2026"));

/**
 * Liste des sortants pour les filtres de l'URL, et la liste entière (pour la carte) seulement si
 * un filtre la restreint réellement : un tri ne fait que la réordonner.
 */
export const chargerSortants = async (filtres: SenatorialesParams) => {
  const restreinte = Boolean(filtres.departement || filtres.groupe);
  const [sortants, tous] = await Promise.all([
    fetchListe<ListeSortants>("/senatoriales/2026/sortants", stringQuery(sortantsQueryOf(filtres))),
    restreinte ? fetchListe<ListeSortants>("/senatoriales/2026/sortants") : Promise.resolve(null),
  ]);
  return { sortants, tousSortants: tous?.data };
};

/** Requête sans valeurs vides, au format attendu par le client serveur. */
const stringQuery = (query: Record<string, string | undefined>) =>
  Object.fromEntries(
    Object.entries(query).filter((entree): entree is [string, string] => Boolean(entree[1])),
  );

/**
 * Circonscription désignée par un segment d'URL. Le slug est validé hors réseau (`null` : slug
 * inconnu, la page répond 404). L'aperçu est lu par `fetchResource` : une API en panne lève une
 * erreur (page d'erreur maîtrisée, et Next garde la version précédente en cache) au lieu de
 * servir un faux 404 ; `undefined` si l'API répond mais ne connaît pas la circonscription.
 */
export const chargerCirconscription = cache(async (slug: string) => {
  const code = codeDepuisSlug(slug);
  if (!code) return null;
  const apercu = await fetchResource<ApercuSenatoriales>("/senatoriales/2026");
  const trouvee = apercu?.circonscriptions.find((c) => c.departement === code);
  if (!apercu || !trouvee) return undefined;
  return {
    apercu,
    circonscription: { ...trouvee, code, nom: libelleCirconscription(trouvee.nom) },
  };
});

/** Même lecture pour les images Open Graph : jamais d'erreur, l'aperçu se replie sans chiffres. */
export const circonscriptionPourImage = async (slug: string) => {
  try {
    return (await chargerCirconscription(slug)) ?? null;
  } catch {
    return null;
  }
};

/** Sortants et candidats d'une circonscription ; `undefined` si l'API ne répond pas. */
export const chargerListesCirconscription = async (code: string) => {
  const [sortants, candidats] = await Promise.all([
    fetchListe<ListeSortants>("/senatoriales/2026/sortants", sortantsCirconscriptionQuery(code)),
    fetchListe<ListeCandidats>("/senatoriales/2026/candidats", { departement: code }),
  ]);
  return { sortants: sortants ?? undefined, candidats: candidats ?? undefined };
};
