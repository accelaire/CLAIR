// =============================================================================
// Pétitions citoyennes : téléchargement et lecture en flux des jeux data.gouv.fr
// =============================================================================
//
// Un fichier par chambre, republié chaque semaine (le lundi vers 2 h UTC, mais
// pas toujours : le 18/11/2026 l'a été un mercredi). La fraîcheur est vérifiée
// par `source-freshness` (ETag et Last-Modified du stockage S3), donc chaque
// nuit, et rien n'est retéléchargé tant que le fichier n'a pas bougé.
//
// Lecture EN FLUX : le conteneur du cron a déjà manqué de mémoire, et les
// descriptions pèsent 10,7 Mo à l'AN. Chaque ligne est passée au rappel puis
// oubliée ; un seul fichier est ouvert à la fois.
//
// Les archives hebdomadaires (une par semaine depuis le 30/07/2025 à l'AN, le
// 12/03/2026 au Sénat) servent au rattrapage des relevés de signatures.
// =============================================================================

import fs from 'fs';
import axios from 'axios';
import { parse } from 'csv-parse';

import type { ChambrePetition, LigneSource } from './normalisation';
import { verifierColonnes } from './normalisation';

/** Stockage d'origine des fichiers (files.data.gouv.fr y redirige). */
const ORIGINE = 'https://data-pipeline-open.s3.sbg.io.cloud.ovh.net';
/** Index public des archives (le stockage d'origine n'est pas listable). */
const INDEX_ARCHIVES = 'https://files.data.gouv.fr/data-pipeline-open';

const DOSSIER: Record<ChambrePetition, string> = {
  assemblee: 'an_petitions',
  senat: 'senat_petitions',
};

/** Le fichier courant d'une chambre. */
export function urlPetitions(chambre: ChambrePetition): string {
  return `${ORIGINE}/${DOSSIER[chambre]}/petitions.csv`;
}

export interface ArchivePetitions {
  /** Date de l'archive, d'après son nom (AAAA-MM-JJ) */
  date: string;
  url: string;
}

/**
 * Les archives hebdomadaires d'une chambre, de la plus ancienne à la plus
 * récente, lues dans l'index public.
 */
export async function listerArchives(chambre: ChambrePetition): Promise<ArchivePetitions[]> {
  const reponse = await axios.get<string>(`${INDEX_ARCHIVES}/${DOSSIER[chambre]}/`, {
    timeout: 30_000,
    responseType: 'text',
    headers: { 'User-Agent': 'CLAIR-Bot/1.0 (https://github.com/clair)' },
  });
  const dates = new Set<string>();
  for (const m of reponse.data.matchAll(/>(\d{4}-\d{2}-\d{2})_petitions\.csv</g)) if (m[1]) dates.add(m[1]);
  return [...dates].sort().map((date) => ({
    date,
    url: `${ORIGINE}/${DOSSIER[chambre]}/${date}_petitions.csv`,
  }));
}

/**
 * Lit un fichier en flux. L'en-tête est vérifié avant la première ligne :
 * une source qui change de forme arrête la lecture au lieu d'écrire des
 * champs décalés.
 */
export async function lireFichierPetitions(
  chemin: string,
  chambre: ChambrePetition,
  surLigne: (ligne: LigneSource) => void | Promise<void>,
): Promise<number> {
  const lecteur = fs.createReadStream(chemin).pipe(
    parse({
      delimiter: ';',
      bom: true,
      columns: (entete: string[]) => {
        verifierColonnes(chambre, entete);
        return entete.map((c) => c.trim());
      },
      skip_empty_lines: true,
    }),
  );
  let n = 0;
  for await (const ligne of lecteur) {
    n++;
    await surLigne(ligne as LigneSource);
  }
  return n;
}
