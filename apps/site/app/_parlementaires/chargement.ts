import "server-only";
import type {
  ApiData,
  Chambre,
  GroupeOption,
  LegislatureDisponible,
  PageMeta,
  PageVotes,
  ParlementaireCompare,
  ParlementaireDetail,
  ParlementaireListItem,
  SessionDisponible,
} from "@clair/data";
import {
  compareQueryOf,
  FICHE_QUERY,
  groupesQueryOf,
  listePaths,
  listeQueryOf,
  metaFiche,
  type ParlementaireFicheInitialData,
  type ParlementairesListeInitialData,
  parseComparateurParams,
  parseParlementaireFicheParams,
  parseParlementairesListeParams,
  votesQueryOf,
} from "@clair/screens";
import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { cache } from "react";
import { fetchResource } from "@/lib/api-server.ts";

/** Paramètres d'URL d'une page de Next. */
export type SearchParams = Record<string, string | string[] | undefined>;

const CHEMINS: Record<Chambre, string> = { assemblee: "/deputes", senat: "/senateurs" };
const AUTRE: Record<Chambre, Chambre> = { assemblee: "senat", senat: "assemblee" };

/** Un bloc secondaire (filtres) ne doit pas faire échouer la page : `undefined` en cas d'erreur. */
const facultatif = async <T>(promesse: Promise<T | null>) => {
  try {
    return (await promesse) ?? undefined;
  } catch {
    return undefined;
  }
};

/** Première page de la liste, groupes et périodes du filtre, pour les paramètres de l'URL. */
export const chargerListe = async (
  chambre: Chambre,
  params: SearchParams,
): Promise<ParlementairesListeInitialData> => {
  const filtres = parseParlementairesListeParams(params, chambre);
  const paths = listePaths(chambre);
  const [liste, groupes, periodes] = await Promise.all([
    facultatif(
      fetchResource<PageMeta<ParlementaireListItem>>(paths.liste, listeQueryOf(filtres, chambre)),
    ),
    facultatif(
      fetchResource<ApiData<GroupeOption[]>>(paths.groupes, groupesQueryOf(filtres, chambre)),
    ),
    facultatif(
      fetchResource<ApiData<Array<LegislatureDisponible | SessionDisponible>>>(paths.periodes),
    ),
  ]);
  // Au-delà de la dernière page, l'API répond une liste vide : pas d'URL explorable sans fin.
  if (filtres.page > 1 && liste && liste.data.length === 0) notFound();
  return { liste, groupes, periodes };
};

/** Fiche (sans `sourceData`, le brut de la source, trop lourd pour la page). Mise en cache par requête. */
export const chargerFiche = cache(async (chambre: Chambre, slug: string) => {
  const reponse = await fetchResource<ApiData<ParlementaireDetail & { sourceData?: unknown }>>(
    `${CHEMINS[chambre]}/${encodeURIComponent(slug)}`,
    FICHE_QUERY,
  );
  if (!reponse) return null;
  const { sourceData: _brut, ...fiche } = reponse.data;
  return { data: fiche };
});

/**
 * Données de la fiche ; slug inconnu : redirection permanente si l'élu a changé de chambre
 * (même slug), 404 sinon.
 */
export const chargerFicheOu404 = async (
  chambre: Chambre,
  slug: string,
  params: SearchParams,
): Promise<ParlementaireFicheInitialData> => {
  const filtres = parseParlementaireFicheParams(params);
  const [fiche, votes] = await Promise.all([
    chargerFiche(chambre, slug),
    filtres.onglet === "votes"
      ? facultatif(
          fetchResource<PageVotes>(
            `${CHEMINS[chambre]}/${encodeURIComponent(slug)}/votes`,
            votesQueryOf(filtres),
          ),
        )
      : undefined,
  ]);
  if (!fiche) {
    const autre = AUTRE[chambre];
    if (await chargerFiche(autre, slug)) {
      // Député élu sénateur dont la fiche n'est pas encore au Sénat : redirection temporaire, la
      // situation se résout d'elle-même (même règle que apps/web). L'inverse est définitif.
      const vers = `${CHEMINS[autre]}/${slug}`;
      if (chambre === "senat") redirect(vers);
      permanentRedirect(vers);
    }
    notFound();
  }
  return { fiche, votes };
};

/** Titre et description d'une fiche, à partir de ses données. */
export const metadonneesFiche = async (chambre: Chambre, slug: string): Promise<Metadata> => {
  const fiche = await chargerFiche(chambre, slug);
  if (!fiche) return {};
  const { title, description } = metaFiche(fiche.data, chambre);
  const url = `${CHEMINS[chambre]}/${fiche.data.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "profile" },
  };
};

/** Élus comparés (deux à quatre), ou `undefined` si l'URL n'en désigne pas assez. */
export const chargerComparaison = async (chambre: Chambre, params: SearchParams) => {
  const filtres = parseComparateurParams(params);
  if (filtres.slugs.length < 2) return undefined;
  return facultatif(
    fetchResource<ApiData<ParlementaireCompare[]>>(
      `${CHEMINS[chambre]}/compare`,
      compareQueryOf(filtres),
    ),
  );
};
