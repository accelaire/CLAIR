// =============================================================================
// Résolution des fichiers de candidatures sur data.gouv
// =============================================================================
//
// Les URLs des ressources sont **versionnées par horodatage** :
//
//   .../20260914-115728/senatoriales-2026-candidatures-listes-...csv
//
// Les figer dans le code reviendrait à ne jamais voir une republication
// corrigée — or c'est précisément le cas qu'on veut attraper : l'édition 2023 a
// été republiée le jour même de sa parution. Une sonde HEAD sur l'ancienne URL
// répondrait toujours 200 avec le même ETag, sans rien signaler.
//
// On interroge donc le jeu de données à chaque passage et on lit les URLs
// courantes de ses ressources.
// =============================================================================

import axios from 'axios';

import { logger } from '../../utils/logger.js';

/**
 * Jeu de données des candidatures aux sénatoriales 2026, publié par le
 * ministère de l'Intérieur.
 *
 * Le slug est stable ; seules les ressources qu'il contient changent.
 */
export const DATASET_CANDIDATURES_2026 =
  'elections-senatoriales-2026-candidatures-aux-scrutins-majoritaire-tour-1-et-proportionnel';

export const API_DATASET_CANDIDATURES_2026 = `https://www.data.gouv.fr/api/1/datasets/${DATASET_CANDIDATURES_2026}/`;

export interface RessourceCandidatures {
  titre: string;
  url: string;
  /** Extension déduite du titre ou de l'URL, pour choisir le lecteur. */
  extension: string;
  modifieeLe: string | null;
}

/**
 * Rend les ressources tabulaires du jeu de données, dans l'ordre de
 * publication.
 *
 * Seuls les CSV et XLSX sont retenus : le producteur ajoute parfois des PDF de
 * notice, qui n'ont rien à faire dans une ingestion. Le format a changé entre
 * les éditions (XLSX jusqu'en 2023, CSV en 2026), donc les deux sont acceptés.
 */
export async function resoudreRessourcesCandidatures(
  urlDataset: string = API_DATASET_CANDIDATURES_2026,
): Promise<RessourceCandidatures[]> {
  const reponse = await axios.get(urlDataset, {
    timeout: 30_000,
    headers: { Accept: 'application/json' },
  });

  const ressources: unknown[] = reponse.data?.resources ?? [];

  const retenues = ressources
    .map((brute) => {
      const ressource = brute as Record<string, unknown>;
      const url = typeof ressource.url === 'string' ? ressource.url : '';
      const titre = typeof ressource.title === 'string' ? ressource.title : url;
      const format = String(ressource.format ?? '').toLowerCase();

      // Le format déclaré prime, l'extension de l'URL sert de repli : le champ
      // `format` est saisi à la main par le producteur et peut manquer.
      const extension = format || url.split('.').pop()?.toLowerCase() || '';

      return {
        titre,
        url,
        extension,
        modifieeLe:
          typeof ressource.last_modified === 'string' ? ressource.last_modified : null,
      };
    })
    .filter((ressource) => ressource.url !== '' && ['csv', 'xlsx'].includes(ressource.extension));

  if (retenues.length === 0) {
    throw new Error(
      `Aucune ressource CSV ou XLSX dans ${urlDataset} — le jeu de données a changé de forme`,
    );
  }

  logger.info(
    { ressources: retenues.map((r) => ({ titre: r.titre, modifieeLe: r.modifieeLe })) },
    'ressources de candidatures résolues',
  );

  return retenues;
}
