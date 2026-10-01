// =============================================================================
// Ingestion des mandats locaux des candidats (Répertoire national des élus)
// =============================================================================
//
// Le répertoire est republié chaque trimestre sous de nouvelles URL : on les
// lit dans le jeu de données à chaque passage, comme pour les candidatures.
//
// Le fichier des conseillers municipaux pèse 65 Mo et compte un demi-million
// de lignes. Il est lu en flux, et seules sont gardées les lignes dont la date
// de naissance est celle d'un candidat : quelques milliers au total.
//
// L'écriture remplace le scrutin en entier, dans une transaction : un mandat
// qui a disparu du répertoire doit disparaître de nos pages.
// =============================================================================

import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import axios from 'axios';
import { parse } from 'csv-parse';
import type { PrismaClient, Prisma } from '@prisma/client';

import { logger } from '../../utils/logger.js';
import { downloadWithRetry } from '../../utils/download.js';
import { clefDate } from './rattachement.js';
import {
  FICHIERS_RNE,
  lireLigneRne,
  mandatsDuCandidat,
  regrouperPersonnes,
} from './mandats-locaux.js';
import type { FichierRne, LigneRne } from './mandats-locaux.js';

/** « Répertoire national des élus », ministère de l'Intérieur. */
export const API_DATASET_RNE = 'https://www.data.gouv.fr/api/1/datasets/5c34c4d1634f4173183a64f1/';

export interface RessourceRne {
  fichier: FichierRne;
  url: string;
  /** AAAA-MM-JJ, date de la ressource sur data.gouv. */
  modifieeLe: string | null;
}

/**
 * URL courantes des fichiers retenus. Chaque fichier est reconnu au suffixe de
 * son titre (« elus-maires-mai.csv », « elus-conseillers-departementaux-cd.csv ») :
 * un fichier manquant fait échouer le passage plutôt que de publier des
 * mandats incomplets.
 */
export async function resoudreRessourcesRne(urlDataset: string = API_DATASET_RNE): Promise<RessourceRne[]> {
  const reponse = await axios.get(urlDataset, { timeout: 30_000, headers: { Accept: 'application/json' } });
  const ressources: Record<string, unknown>[] = reponse.data?.resources ?? [];

  return FICHIERS_RNE.map((fichier) => {
    const trouvee = ressources.find((r) => {
      const titre = String(r.title ?? '');
      return new RegExp(`-${fichier}\\.csv$`, 'i').test(titre);
    });
    if (!trouvee || typeof trouvee.url !== 'string') {
      throw new Error(`Fichier « ${fichier} » introuvable dans le Répertoire national des élus`);
    }
    const modifiee = typeof trouvee.last_modified === 'string' ? trouvee.last_modified.slice(0, 10) : null;
    return { fichier, url: trouvee.url, modifieeLe: modifiee };
  });
}

/** Lit un fichier en flux et ne garde que les lignes nées l'un des jours donnés. */
export async function lireFichierRne(chemin: string, fichier: FichierRne, dates: Set<string>): Promise<LigneRne[]> {
  const lignes: LigneRne[] = [];
  const lecteur = fs.createReadStream(chemin).pipe(
    parse({
      columns: true,
      delimiter: ';',
      bom: true,
      relax_quotes: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    })
  );
  for await (const brute of lecteur as AsyncIterable<Record<string, string>>) {
    if (!dates.has(brute['Date de naissance'] ?? '')) continue;
    const ligne = lireLigneRne(fichier, brute);
    if (ligne) lignes.push(ligne);
  }
  return lignes;
}

export interface OptionsMandatsLocaux {
  scrutin: string;
  simulation?: boolean;
  /** Dossier contenant déjà les fichiers (`<fichier>.csv`), sans téléchargement. */
  dossierLocal?: string;
}

export interface RapportMandatsLocaux {
  scrutin: string;
  titulaires: number;
  niveauA: number;
  niveauB: number;
  sansMandat: number;
  lignesLues: Record<string, number>;
  sourceDate: string;
  simulation: boolean;
}

export async function synchroniserMandatsLocaux(
  prisma: PrismaClient,
  options: OptionsMandatsLocaux
): Promise<RapportMandatsLocaux> {
  const candidats = await prisma.candidature.findMany({
    where: { role: 'titulaire', liste: { scrutin: options.scrutin } },
    select: { nom: true, prenom: true, dateNaissance: true },
  });
  if (candidats.length === 0) throw new Error(`Aucun candidat titulaire pour ${options.scrutin}`);

  const dates = new Set(candidats.map((c) => clefDate(c.dateNaissance)).filter((d): d is string => d !== null));

  const ressources: { fichier: FichierRne; chemin: string; modifieeLe: string | null }[] = [];
  const temporaires: string[] = [];
  try {
    if (options.dossierLocal) {
      for (const fichier of FICHIERS_RNE) {
        ressources.push({ fichier, chemin: path.join(options.dossierLocal, `${fichier}.csv`), modifieeLe: null });
      }
    } else {
      for (const ressource of await resoudreRessourcesRne()) {
        const chemin = path.join(os.tmpdir(), `rne-${Date.now()}-${ressource.fichier}.csv`);
        await downloadWithRetry(ressource.url, chemin);
        temporaires.push(chemin);
        ressources.push({ fichier: ressource.fichier, chemin, modifieeLe: ressource.modifieeLe });
      }
    }

    const lignes: LigneRne[] = [];
    const lignesLues: Record<string, number> = {};
    for (const ressource of ressources) {
      const lues = await lireFichierRne(ressource.chemin, ressource.fichier, dates);
      lignesLues[ressource.fichier] = lues.length;
      lignes.push(...lues);
    }

    // La date citée est celle du fichier le plus récent : les fichiers des
    // Français de l'étranger ont un trimestre de retard sur les autres.
    const sourceDate =
      ressources
        .map((r) => r.modifieeLe)
        .filter((d): d is string => d !== null)
        .sort()
        .pop() ?? new Date().toISOString().slice(0, 10);

    const index = regrouperPersonnes(lignes);
    const rapport: RapportMandatsLocaux = {
      scrutin: options.scrutin,
      titulaires: candidats.length,
      niveauA: 0,
      niveauB: 0,
      sansMandat: 0,
      lignesLues,
      sourceDate,
      simulation: options.simulation ?? false,
    };

    const lignesEcrites = new Map<string, Prisma.CandidatMandatsLocauxCreateManyInput>();
    for (const candidat of candidats) {
      const rattaches = mandatsDuCandidat(candidat, index);
      if (!rattaches || rattaches.mandats.length === 0 || !candidat.dateNaissance) {
        rapport.sansMandat += 1;
        continue;
      }
      if (rattaches.confiance === 'A') rapport.niveauA += 1;
      else rapport.niveauB += 1;

      const clef = `${candidat.nom}|${candidat.prenom}|${clefDate(candidat.dateNaissance)}`;
      lignesEcrites.set(clef, {
        id: randomUUID(),
        scrutin: options.scrutin,
        nom: candidat.nom,
        prenom: candidat.prenom,
        dateNaissance: new Date(`${clefDate(candidat.dateNaissance)}T00:00:00Z`),
        mandats: rattaches.mandats as unknown as Prisma.InputJsonValue,
        confiance: rattaches.confiance,
        sourceDate: new Date(`${sourceDate}T00:00:00Z`),
      });
    }

    if (!rapport.simulation) {
      await prisma.$transaction(async (transaction) => {
        await transaction.candidatMandatsLocaux.deleteMany({ where: { scrutin: options.scrutin } });
        await transaction.candidatMandatsLocaux.createMany({ data: [...lignesEcrites.values()] });
      });
    }

    logger.info({ ...rapport }, 'mandats locaux des candidats');
    return rapport;
  } finally {
    await Promise.all(temporaires.map((chemin) => fs.promises.rm(chemin, { force: true })));
  }
}
