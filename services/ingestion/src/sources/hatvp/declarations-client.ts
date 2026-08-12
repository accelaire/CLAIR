// =============================================================================
// Client HATVP Déclarations — Parse liste.csv pour les déclarations des élus
// Source: https://www.hatvp.fr/livraison/opendata/liste.csv
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { parse } from 'csv-parse/sync';
import axios from 'axios';
import { logger } from '../../utils/logger.js';

/** Ligne d'un CSV HATVP parsé avec `columns: true` (toutes les valeurs sont des chaînes). */
type CsvRow = Record<string, string>;

const LISTE_CSV_URL = 'https://www.hatvp.fr/livraison/opendata/liste.csv';
const HATVP_BASE_URL = 'https://www.hatvp.fr';

// Types de déclarations
export const DECLARATION_TYPES: Record<string, string> = {
  di: "Déclaration d'intérêts",
  dia: "Déclaration d'intérêts et d'activités",
  diam: "Déclaration d'intérêts et d'activités (modification)",
  dsp: 'Déclaration de situation patrimoniale',
  dspm: 'Déclaration de situation patrimoniale (modification)',
  dspfm: 'Déclaration de situation patrimoniale (fin de mandat)',
};

export interface HATVPDeclarationRow {
  civilite: string;
  prenom: string;
  nom: string;
  classement: string;
  typeMandat: string;       // 'depute' | 'senateur'
  qualite: string;          // 'Député du Rhône', 'Sénatrice des Bouches-du-Rhône'
  typeDocument: string;     // di, dia, diam, dsp, dspm, dspfm
  departement: string;
  datePublication: string | null;
  dateDepot: string | null;
  nomFichier: string | null;   // PDF
  urlDossier: string | null;
  xmlFichier: string | null;   // Open data XML
  statut: string | null;
  idOrigine: string | null;    // ID AN photo (pour matching)
  urlPhoto: string | null;
}

/**
 * Télécharge et parse liste.csv, filtre pour les parlementaires.
 */
export async function fetchDeclarationsParlementaires(): Promise<HATVPDeclarationRow[]> {
  const tempDir = path.join(os.tmpdir(), 'clair-hatvp-declarations');
  const csvPath = path.join(tempDir, 'liste.csv');

  try {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
    await fs.promises.mkdir(tempDir, { recursive: true });

    logger.info({ url: LISTE_CSV_URL }, 'Downloading HATVP declarations list...');
    const response = await axios({
      method: 'GET',
      url: LISTE_CSV_URL,
      responseType: 'stream',
      timeout: 60_000,
      headers: {
        'User-Agent': 'CLAIR-Bot/1.0 (transparence parlementaire)',
      },
    });

    const writer = createWriteStream(csvPath);
    await pipeline(response.data, writer);

    const stats = await fs.promises.stat(csvPath);
    logger.info({ sizeMB: (stats.size / 1024 / 1024).toFixed(2) }, 'HATVP liste.csv downloaded');

    // Parse CSV
    const content = await fs.promises.readFile(csvPath, 'utf-8');
    const rows = parse(content, {
      delimiter: ';',
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
    }) as CsvRow[];

    logger.info({ totalRows: rows.length }, 'CSV parsed');

    // Filter for parlementaires only
    const parlementaireRows = rows.filter(
      (r: CsvRow) => r.type_mandat === 'depute' || r.type_mandat === 'senateur'
    );

    logger.info({ parlementaires: parlementaireRows.length }, 'Parlementaire declarations filtered');

    return parlementaireRows.map((r: CsvRow) => ({
      civilite: r.civilite || '',
      prenom: r.prenom || '',
      nom: r.nom || '',
      classement: r.classement || '',
      typeMandat: r.type_mandat ?? '',
      qualite: r.qualite || '',
      typeDocument: r.type_document || '',
      departement: r.departement || '',
      datePublication: r.date_publication || null,
      dateDepot: r.date_depot || null,
      nomFichier: r.nom_fichier || null,
      urlDossier: r.url_dossier ? `${HATVP_BASE_URL}${r.url_dossier}` : null,
      xmlFichier: r.open_data || null,
      statut: r.statut_publication || null,
      idOrigine: r.id_origine || null,
      urlPhoto: r.url_photo || null,
    }));
  } finally {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

/**
 * Normalise un nom pour le matching (minuscules, sans accents, sans tirets).
 */
export function normalizeNameForMatching(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[-']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
