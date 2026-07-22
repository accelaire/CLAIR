// =============================================================================
// Client Sénat — Open data « anciens sénateurs » (data.senat.fr)
//
// Trois CSV, joints par MATRICULE (= `parlementaires.source_id`) :
//   - ODSEN_GENERAL.csv      → identité de TOUS les sénateurs (ACTIF + ANCIEN)
//   - ODSEN_ELUSEN.csv       → mandats sénatoriaux avec dates début/fin réelles
//   - ODSEN_HISTOGROUPES.csv → appartenances aux groupes, datées
//
// Ces fichiers complètent `senateurs.json` (qui n'expose QUE les sénateurs en cours,
// sans aucune date de mandat) et débloquent la profondeur historique du Sénat.
//
// Pièges de format : encodage latin1, fins de ligne CRLF, en-tête précédé de lignes
// de commentaire `%` (qui portent la requête SQL), délimiteur virgule, dates au
// format `YYYY-MM-DD 00:00:00.0`.
//
// ⚠️ Fraîcheur : l'export ELUSEN est figé avant le renouvellement de sept. 2023
// (aucun mandat postérieur à début 2023). Il fournit donc la couche HISTORIQUE
// (séries élues en 2017 et 2020) ; les mandats COURANTS restent alimentés par
// `senateurs.json`. La correction des mandats « ouverts » périmés est faite en aval
// par `deriveMandatContextSenatOdsen` (voir workers/mandats.ts).
// =============================================================================

import axios from 'axios';
import { parse } from 'csv-parse/sync';
import { logger } from '../../utils/logger';

const BASE_URL = 'https://data.senat.fr/data/senateurs';

// =============================================================================
// TYPES
// =============================================================================

export interface OdsenSenateurIdentite {
  matricule: string;
  etat: 'ACTIF' | 'ANCIEN';
  nom: string;
  prenom: string;
  sexe: string; // 'M' | 'F'
  dateNaissance: Date | null;
  dateDeces: Date | null;
  profession: string | null;
  circonscription: string | null; // libellé département (ex. « Hautes-Pyrénées »)
}

export interface OdsenMandatRow {
  matricule: string;
  eluid: string;
  dateDebut: Date | null;
  dateFin: Date | null;
  motifFin: string | null;
}

export interface OdsenAppartenanceGroupe {
  matricule: string;
  groupeCode: string; // ex. « UMP », « SOC », « CRC »
  groupeLibelle: string; // ex. « Groupe Les Républicains »
  dateDebut: Date | null;
  dateFin: Date | null;
}

export interface OdsenData {
  identites: Map<string, OdsenSenateurIdentite>;
  mandats: OdsenMandatRow[];
  appartenances: OdsenAppartenanceGroupe[];
}

// =============================================================================
// HELPERS DE PARSING
// =============================================================================

/** Télécharge un CSV ODSEN, le décode en latin1 et retire les lignes de commentaire `%`. */
async function fetchCsvRows(fichier: string): Promise<Record<string, string>[]> {
  const url = `${BASE_URL}/${fichier}`;
  logger.info({ url }, 'Fetching ODSEN CSV...');

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000,
    headers: { 'User-Agent': 'CLAIR-Bot/1.0 (https://github.com/clair)' },
  });

  // Latin1 + CRLF ; on retire les lignes de commentaire `%` (requête SQL en tête).
  const raw = new TextDecoder('latin1').decode(response.data as ArrayBuffer);
  const sansCommentaires = raw
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('%'))
    .join('\n');

  const rows = parse(sansCommentaires, {
    columns: true,
    delimiter: ',',
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, string>[];

  logger.info({ fichier, rows: rows.length }, 'ODSEN CSV parsed');
  return rows;
}

/** Convertit une date ODSEN (`YYYY-MM-DD 00:00:00.0`, ou vide) en `Date` UTC. */
function parseOdsenDate(value: string | undefined): Date | null {
  const v = (value ?? '').trim();
  if (v.length < 10) return null;
  const y = Number(v.slice(0, 4));
  const m = Number(v.slice(5, 7));
  const d = Number(v.slice(8, 10));
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

/** Qualité (« M. » / « Mme » / « Mlle ») → sexe. */
function qualiteToSexe(qualite: string | undefined): string {
  return (qualite ?? '').trim() === 'M.' ? 'M' : 'F';
}

// =============================================================================
// CLIENT
// =============================================================================

export class SenatHistoClient {
  async getData(): Promise<OdsenData> {
    const [generalRows, elusenRows, histoRows] = await Promise.all([
      fetchCsvRows('ODSEN_GENERAL.csv'),
      fetchCsvRows('ODSEN_ELUSEN.csv'),
      fetchCsvRows('ODSEN_HISTOGROUPES.csv'),
    ]);

    const identites = new Map<string, OdsenSenateurIdentite>();
    for (const row of generalRows) {
      const matricule = row['Matricule']?.trim();
      const etat = row['État']?.trim();
      if (!matricule || (etat !== 'ACTIF' && etat !== 'ANCIEN')) continue;
      identites.set(matricule, {
        matricule,
        etat: etat as 'ACTIF' | 'ANCIEN',
        nom: row['Nom usuel']?.trim() ?? '',
        prenom: row['Prénom usuel']?.trim() ?? '',
        sexe: qualiteToSexe(row['Qualité']),
        dateNaissance: parseOdsenDate(row['Date naissance']),
        dateDeces: parseOdsenDate(row['Date de décès']),
        profession: row['Catégorie professionnelle']?.trim() || null,
        circonscription: row['Circonscription']?.trim() || null,
      });
    }

    const mandats: OdsenMandatRow[] = [];
    for (const row of elusenRows) {
      const matricule = row['Matricule']?.trim();
      if (!matricule) continue;
      mandats.push({
        matricule,
        eluid: row['Identifiant mandat']?.trim() ?? '',
        dateDebut: parseOdsenDate(row['Date de début de mandat']),
        dateFin: parseOdsenDate(row['Date de fin de mandat']),
        motifFin: row['Motif fin de mandat']?.trim() || null,
      });
    }

    const appartenances: OdsenAppartenanceGroupe[] = [];
    for (const row of histoRows) {
      const matricule = row['Matricule']?.trim();
      const groupeCode = row['Code du groupe politique']?.trim();
      if (!matricule || !groupeCode) continue;
      appartenances.push({
        matricule,
        groupeCode,
        groupeLibelle: row['Nom court du groupe politique']?.trim() ?? '',
        dateDebut: parseOdsenDate(row["Date de début d'appartenance"]),
        dateFin: parseOdsenDate(row["Date de fin d'appartenance"]),
      });
    }

    logger.info(
      { identites: identites.size, mandats: mandats.length, appartenances: appartenances.length },
      'ODSEN data loaded',
    );
    return { identites, mandats, appartenances };
  }
}

export default SenatHistoClient;
