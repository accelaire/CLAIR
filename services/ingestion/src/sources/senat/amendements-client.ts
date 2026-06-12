// =============================================================================
// Client Sénat - Récupération des amendements (base AMELI)
// Source: https://data.senat.fr/ameli/
// =============================================================================

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createReadStream } from 'fs';
import * as readline from 'readline';
import { logger } from '../../utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface SenatAmendement {
  id: number;
  numero: string;
  dispositif: string | null;
  objet: string | null;
  dateDepot: Date | null;
  sort: string | null;
  sortCode: string | null;
  texteId: number;
  auteurs: SenatAmendementAuteur[];
}

export interface SenatAmendementAuteur {
  senId: number;
  rang: number;
  qualite: string;
  nom: string;
  prenom: string;
  matricule?: string;
  groupeId?: number;
}

export interface TransformedAmendementSenat {
  uid: string;
  numero: string;
  dispositif: string | null;
  exposeSommaire: string | null;
  dateDepot: Date | null;
  sort: string | null;
  auteurNom: string | null;
  auteurPrenom: string | null;
  auteurMatricule: string | null;
  auteurLibelle: string | null;
  texteRef: string | null;
  sourceUrl: string | null;
  articleVise?: string | null;
  cosignatairesMatricules: string[];
}

// =============================================================================
// HELPERS
// =============================================================================

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '…')
    .replace(/&oelig;/g, 'œ')
    .replace(/&OElig;/g, 'Œ')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&agrave;/g, 'à')
    .replace(/&ccedil;/g, 'ç');
}

function stripHtml(html: string | null): string | null {
  if (!html) return null;
  // Convert block elements to newlines before stripping
  let text = html
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n');
  // Remove remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');
  text = decodeHtmlEntities(text);
  // Convert escaped newlines from SQL dump to actual newlines
  text = text.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n');
  // Collapse multiple spaces (but preserve newlines)
  text = text.replace(/[^\S\n]+/g, ' ');
  // Collapse multiple newlines to max 2
  text = text.replace(/\n{3,}/g, '\n\n');
  // Trim each line
  text = text.split('\n').map(line => line.trim()).join('\n');
  return text.trim();
}

/**
 * Normalise un numéro d'amendement Sénat pour la jointure AMELI ↔ CSV.
 * AMELI stocke le numéro de base (la rectification est dans un champ `rev` séparé),
 * le CSV inclut le suffixe ("4 rect.", "77 rect. bis") → on retire tout à partir de " rect".
 */
export function normalizeSenatNumero(numero: string): string {
  return numero.replace(/\s+rect\b.*$/i, '').trim();
}

function parseDate(dateStr: string | null): Date | null {
  if (!dateStr || dateStr === '\\N') return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

// Sort codes mapping
const SORT_MAP: Record<string, string> = {
  'A': 'adopte',
  'R': 'retire',
  'J': 'rejete',
  'K': 'rejete',
  'N': 'non_soutenu',
  'S': 'tombe',
  'B': 'adopte',
  '1': 'adopte',
  '2': 'adopte_modifie',
  '3': 'rejete',
  '4': 'retire',
  '5': 'satisfait',
  '6': 'non_examine',
};

// CSV sort labels (French) → code
const CSV_SORT_MAP: Record<string, string> = {
  'Adopté': 'adopte',
  'Adopté avec modification': 'adopte_modifie',
  'Rejeté': 'rejete',
  'Retiré': 'retire',
  'Retiré avant discussion': 'retire',
  'Tombé': 'tombe',
  'Non soutenu': 'non_soutenu',
  'Irrecevable': 'irrecevable',
  'Irrecevable art. 40': 'irrecevable',
  'Irrecevable art. 41': 'irrecevable',
  'Irrecevable art. 44 bis': 'irrecevable',
  'Irrecevable art. 45': 'irrecevable',
  'Satisfait ou sans objet': 'satisfait',
};

function mapCsvSort(sort: string | null): string | null {
  if (!sort || sort === '\\N') return null;
  const trimmed = sort.trim();
  // Exact match first
  if (CSV_SORT_MAP[trimmed]) return CSV_SORT_MAP[trimmed];
  // Prefix match for variations like "Retiré avant séance"
  for (const [key, value] of Object.entries(CSV_SORT_MAP)) {
    if (trimmed.startsWith(key)) return value;
  }
  return trimmed.toLowerCase().replace(/\s+/g, '_');
}

// =============================================================================
// CLIENT
// =============================================================================

export class SenatAmendementsClient {
  private dataUrl: string;

  constructor() {
    this.dataUrl = 'https://data.senat.fr/data/ameli/ameli.zip';
    logger.info('SenatAmendementsClient initialized');
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private async downloadFile(url: string, destPath: string): Promise<void> {
    logger.info({ url }, 'Downloading Sénat AMELI data (this may take a while ~140MB)...');

    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      timeout: 600000, // 10 minutes
      headers: {
        'User-Agent': 'CLAIR-Bot/1.0 (https://github.com/clair)',
      },
    });

    const writer = createWriteStream(destPath);
    await pipeline(response.data, writer);

    logger.info({ destPath }, 'File downloaded');
  }

  private async extractZip(zipPath: string, extractDir: string): Promise<string> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    await fs.promises.mkdir(extractDir, { recursive: true });

    try {
      await execAsync(`unzip -o "${zipPath}" -d "${extractDir}"`, {
        maxBuffer: 1024 * 1024 * 100,
      });

      // Find the SQL file
      const files = await fs.promises.readdir(extractDir, { recursive: true });
      const sqlFile = files.find(f => f.toString().endsWith('.sql'));

      if (!sqlFile) {
        throw new Error('No SQL file found in archive');
      }

      const sqlPath = path.join(extractDir, sqlFile.toString());
      logger.info({ sqlPath }, 'SQL file extracted');
      return sqlPath;

    } catch (error: any) {
      logger.error({ error: error.message }, 'Extraction failed');
      throw new Error(`ZIP extraction failed: ${error.message}`);
    }
  }

  // ===========================================================================
  // SQL PARSER
  // ===========================================================================

  private async parseSqlDump(sqlPath: string, options: { maxAmendements?: number; minYear?: number } = {}): Promise<{
    amendements: Map<number, SenatAmendement>;
    senateurs: Map<number, { matricule: string; nom: string; prenom: string }>;
  }> {
    const maxAmendements = options.maxAmendements || 50000;
    const minYear = options.minYear || new Date().getFullYear() - 3;
    const minDate = new Date(minYear, 0, 1);

    const amendements = new Map<number, SenatAmendement>();
    const amdSenLinks: Array<{ amdId: number; senId: number; rang: number; qua: string; nom: string; prenom: string; grpId: number }> = [];
    const senateurs = new Map<number, { matricule: string; nom: string; prenom: string }>();
    const sortMap = new Map<string, { lib: string; cod: string }>();

    const rl = readline.createInterface({
      input: createReadStream(sqlPath, { encoding: 'latin1' }),
      crlfDelay: Infinity,
    });

    let currentTable: string | null = null;
    let lineCount = 0;
    let amendementCount = 0;

    for await (const line of rl) {
      lineCount++;

      // Detect COPY statements
      if (line.startsWith('COPY ')) {
        const match = line.match(/COPY (\w+)/);
        if (match) {
          currentTable = match[1];
        }
        continue;
      }

      // End of COPY block
      if (line === '\\.' || line === '\\.') {
        currentTable = null;
        continue;
      }

      if (!currentTable) continue;

      const fields = line.split('\t');

      try {
        // Parse amendments (amd table)
        if (currentTable === 'amd' && amendementCount < maxAmendements) {
          // Fields: id, subid, amdperid, motid, etaid, nomentid, sorid, avcid, avgid, irrid, txtid, ...
          // num(15), rev(16), typ(17), dis(18), obj(19), datdep(20)
          if (fields.length < 21) continue;
          const id = parseInt(fields[0] ?? '0', 10);
          const sorid = (fields[6] ?? '') !== '\\N' ? (fields[6] ?? null) : null;
          const txtid = parseInt(fields[10] ?? '0', 10);
          const num = (fields[15] ?? '') !== '\\N' ? (fields[15] ?? '') : '';
          const dis = (fields[18] ?? '') !== '\\N' ? (fields[18] ?? null) : null;
          const obj = (fields[19] ?? '') !== '\\N' ? (fields[19] ?? null) : null;
          const datdep = (fields[20] ?? '') !== '\\N' ? (fields[20] ?? null) : null;

          const dateDepot = parseDate(datdep ?? null);

          // Filter by date
          if (dateDepot && dateDepot >= minDate) {
            amendements.set(id, {
              id,
              numero: (num ?? '').trim(),
              dispositif: stripHtml(dis ?? null),
              objet: stripHtml(obj ?? null),
              dateDepot,
              sort: sortMap.get(sorid ?? '')?.lib ?? null,
              sortCode: sorid,
              texteId: txtid,
              auteurs: [],
            });
            amendementCount++;

            if (amendementCount % 5000 === 0) {
              logger.debug({ count: amendementCount }, 'Parsing amendments...');
            }
          }
        }

        // Parse amendment-senator links (amdsen table)
        if (currentTable === 'amdsen') {
          // Fields: amdid, senid, rng, qua, nomuse, prenomuse, hom, grpid
          if (fields.length < 8) continue;
          const amdId = parseInt(fields[0] ?? '0', 10);
          const senId = parseInt(fields[1] ?? '0', 10);
          const rang = parseInt(fields[2] ?? '0', 10) || 0;
          const qua = fields[3] ?? '';
          const nom = fields[4] ?? '';
          const prenom = fields[5] ?? '';
          const grpId = parseInt(fields[7] ?? '0', 10) || 0;

          amdSenLinks.push({ amdId, senId, rang, qua, nom, prenom, grpId });
        }

        // Parse senators (sen_ameli table)
        if (currentTable === 'sen_ameli') {
          // Fields: entid, grpid, comid, comspcid, mat, qua, nomuse, prenomuse, ...
          if (fields.length < 8) continue;
          const entId = parseInt(fields[0] ?? '0', 10);
          const mat = (fields[4] ?? '') !== '\\N' ? (fields[4] ?? '') : '';
          const nom = fields[6] ?? '';
          const prenom = fields[7] ?? '';

          senateurs.set(entId, { matricule: mat, nom, prenom });
        }

        // Parse sort codes (sor table)
        if (currentTable === 'sor') {
          // Fields: id, lib, cod, typ
          if (fields.length < 3) continue;
          const id = fields[0] ?? '';
          const lib = fields[1] ?? '';
          const cod = fields[2] ?? '';
          sortMap.set(id, { lib, cod });
        }

      } catch (e: any) {
        // Skip malformed lines
        if (lineCount % 100000 === 0) {
          logger.warn({ line: lineCount, error: e.message }, 'Parse error');
        }
      }
    }

    logger.info({ amendements: amendements.size, senateurs: senateurs.size, links: amdSenLinks.length }, 'SQL parsing completed');

    // Link authors to amendments
    for (const link of amdSenLinks) {
      const amd = amendements.get(link.amdId);
      if (amd) {
        const sen = senateurs.get(link.senId);
        amd.auteurs.push({
          senId: link.senId,
          rang: link.rang,
          qualite: link.qua,
          nom: link.nom,
          prenom: link.prenom,
          matricule: sen?.matricule,
          groupeId: link.grpId,
        });
      }
    }

    // Sort authors by rang
    for (const amd of Array.from(amendements.values())) {
      amd.auteurs.sort((a, b) => a.rang - b.rang);
    }

    return { amendements, senateurs };
  }

  // ===========================================================================
  // FETCH AMENDEMENTS
  // ===========================================================================

  async getAmendements(options: { maxAmendements?: number; minYear?: number } = {}): Promise<TransformedAmendementSenat[]> {
    const tempDir = path.join(os.tmpdir(), 'clair-amendements-senat');
    const zipPath = path.join(tempDir, 'ameli.zip');
    const extractDir = path.join(tempDir, 'extracted');

    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      await fs.promises.mkdir(tempDir, { recursive: true });

      // Download
      await this.downloadFile(this.dataUrl, zipPath);

      // Extract
      const sqlPath = await this.extractZip(zipPath, extractDir);

      // Parse
      logger.info('Parsing SQL dump...');
      const { amendements } = await this.parseSqlDump(sqlPath, options);

      // Transform
      const transformed: TransformedAmendementSenat[] = [];

      for (const amd of Array.from(amendements.values())) {
        const auteurPrincipal = amd.auteurs[0];

        // Build auteur libelle
        let auteurLibelle: string | null = null;
        if (amd.auteurs.length > 0) {
          const noms = amd.auteurs.map(a => `${a.qualite} ${a.prenom} ${a.nom}`.trim());
          auteurLibelle = noms.join(', ');
          if (auteurLibelle.length > 500) {
            auteurLibelle = noms.slice(0, 3).join(', ') + ` et ${noms.length - 3} autres`;
          }
        }

        transformed.push({
          uid: `SENAT-AMD-${amd.id}`,
          numero: amd.numero,
          dispositif: amd.dispositif?.substring(0, 5000) || null,
          exposeSommaire: amd.objet?.substring(0, 5000) || null,
          dateDepot: amd.dateDepot,
          sort: amd.sortCode ? (SORT_MAP[amd.sortCode] || amd.sort) : null,
          auteurNom: auteurPrincipal?.nom || null,
          auteurPrenom: auteurPrincipal?.prenom || null,
          auteurMatricule: auteurPrincipal?.matricule || null,
          auteurLibelle,
          texteRef: amd.texteId ? `SENAT-TXT-${amd.texteId}` : null,
          sourceUrl: amd.numero ? `https://www.senat.fr/amendements/${amd.numero}.html` : null,
          cosignatairesMatricules: amd.auteurs.slice(1)
            .map(a => a.matricule)
            .filter((m): m is string => !!m),
        });
      }

      logger.info({ count: transformed.length }, 'Amendements Sénat extracted');
      return transformed;

    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // ===========================================================================
  // AMELI MAPPINGS (lightweight parse: textes + cosignataires)
  // ===========================================================================

  /**
   * Parse AMELI dump to extract:
   * - texteMapping: texteId → { num (externe), session }
   * - cosignatairesByKey: `${session}/${texteNum}:${numeroAmendement}` → matricules cosignataires
   *
   * Single pass over the dump. Table order in the dump is alphabetical
   * (amd → amdsen → sen_ameli → ses → txt_ameli), so amdsen links can be
   * filtered against retained amd ids inline, but ses/txt_ameli resolution
   * happens after the loop. Much lighter than the full parse (no dispositif/objet).
   */
  async getAmeliMappings(options: { minYear?: number } = {}): Promise<{
    texteMapping: Map<number, { num: string; session: string }>;
    cosignatairesByKey: Map<string, string[]>;
  }> {
    const tempDir = path.join(os.tmpdir(), 'clair-ameli-mapping');
    const zipPath = path.join(tempDir, 'ameli.zip');
    const extractDir = path.join(tempDir, 'extracted');

    const minYear = options.minYear ?? (new Date().getFullYear() - 3);
    const minDate = new Date(minYear, 0, 1);

    const amdMap = new Map<number, { txtid: number; numero: string }>();
    const amdSenLinks: Array<{ amdId: number; senId: number; rang: number }> = [];
    const senMatriculeMap = new Map<number, string>();
    const sesMap = new Map<number, string>(); // sesId → session label (e.g. "2025-2026")
    const texteMapping = new Map<number, { num: string; session: string }>();

    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      await fs.promises.mkdir(tempDir, { recursive: true });

      await this.downloadFile(this.dataUrl, zipPath);
      const sqlPath = await this.extractZip(zipPath, extractDir);

      const rl = readline.createInterface({
        input: createReadStream(sqlPath, { encoding: 'latin1' }),
        crlfDelay: Infinity,
      });

      let currentTable: string | null = null;

      for await (const line of rl) {
        if (line.startsWith('COPY ')) {
          const match = line.match(/COPY (\w+)/);
          if (match) currentTable = match[1] ?? null;
          continue;
        }
        if (line === '\\.') {
          currentTable = null;
          continue;
        }
        if (!currentTable) continue;

        const fields = line.split('\t');

        try {
          // amd table: id(0), ..., txtid(10), ..., num(15), ..., datdep(20)
          // Seuls les amendements récents sont retenus (filtre mémoire)
          if (currentTable === 'amd') {
            if (fields.length < 21) continue;
            const id = parseInt(fields[0] ?? '0', 10);
            const txtid = parseInt(fields[10] ?? '0', 10);
            const num = (fields[15] ?? '').trim();
            const datdep = (fields[20] ?? '') !== '\\N' ? (fields[20] ?? null) : null;
            const dateDepot = parseDate(datdep);
            if (dateDepot && dateDepot >= minDate) {
              amdMap.set(id, { txtid, numero: num });
            }
          }

          // amdsen table: amdid(0), senid(1), rng(2) — seulement pour les amd retenus
          if (currentTable === 'amdsen') {
            if (fields.length < 8) continue;
            const amdId = parseInt(fields[0] ?? '0', 10);
            if (!amdMap.has(amdId)) continue;
            const senId = parseInt(fields[1] ?? '0', 10);
            const rang = parseInt(fields[2] ?? '0', 10) || 0;
            amdSenLinks.push({ amdId, senId, rang });
          }

          // sen_ameli table: entid(0), ..., mat(4)
          if (currentTable === 'sen_ameli') {
            if (fields.length < 8) continue;
            const entId = parseInt(fields[0] ?? '0', 10);
            const mat = (fields[4] ?? '').trim();
            if (mat && mat !== '\\N') {
              senMatriculeMap.set(entId, mat);
            }
          }

          // ses table: id, typid, ann, lil
          if (currentTable === 'ses') {
            if (fields.length < 4) continue;
            const id = parseInt(fields[0] ?? '0', 10);
            const lil = (fields[3] ?? '').trim();
            if (id && lil && lil !== '\\N') {
              sesMap.set(id, lil);
            }
          }

          // txt_ameli table: id(0), ..., sesinsid(3), ..., num(6), ...
          if (currentTable === 'txt_ameli') {
            if (fields.length < 7) continue;
            const id = parseInt(fields[0] ?? '0', 10);
            const sesinsid = parseInt(fields[3] ?? '0', 10);
            const num = (fields[6] ?? '').trim();
            if (id && num && num !== '\\N') {
              const session = sesMap.get(sesinsid);
              if (session) {
                texteMapping.set(id, { num, session });
              }
            }
          }
        } catch {
          // Skip malformed lines
        }
      }

      // Grouper les liens par amendement
      const linksByAmd = new Map<number, Array<{ amdId: number; senId: number; rang: number }>>();
      for (const link of amdSenLinks) {
        const list = linksByAmd.get(link.amdId);
        if (list) {
          list.push(link);
        } else {
          linksByAmd.set(link.amdId, [link]);
        }
      }

      // Produire les cosignataires par clé session/texteNum:numero
      // En cas de collision (même numero sur plusieurs lectures), garder le txtid
      // le plus grand (lecture la plus récente, cohérent avec le dedup du CSV sync)
      const keyMaxTxtid = new Map<string, { txtid: number; cosignataires: string[] }>();

      for (const [amdId, amdData] of amdMap) {
        const links = linksByAmd.get(amdId);
        if (!links || links.length === 0) continue;
        if (!amdData.numero) continue;

        const texte = texteMapping.get(amdData.txtid);
        if (!texte) continue;

        // Retirer l'auteur principal (rang le plus bas), mapper les senId → matricules
        const sorted = [...links].sort((a, b) => a.rang - b.rang);
        const matricules = sorted.slice(1)
          .map(link => senMatriculeMap.get(link.senId))
          .filter((m): m is string => !!m);
        if (matricules.length === 0) continue;

        const key = `${texte.session}/${texte.num}:${normalizeSenatNumero(amdData.numero)}`;
        const existing = keyMaxTxtid.get(key);
        if (!existing || amdData.txtid > existing.txtid) {
          keyMaxTxtid.set(key, { txtid: amdData.txtid, cosignataires: matricules });
        }
      }

      const cosignatairesByKey = new Map<string, string[]>();
      for (const [key, { cosignataires }] of keyMaxTxtid) {
        cosignatairesByKey.set(key, cosignataires);
      }

      logger.info({
        sessions: sesMap.size,
        textes: texteMapping.size,
        amendementsRetenus: amdMap.size,
        clesCosignataires: cosignatairesByKey.size,
      }, 'AMELI mappings extracted');

      return { texteMapping, cosignatairesByKey };

    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * Wrapper autour de getAmeliMappings, ne conserve que le mapping des textes.
   */
  async getTexteMapping(): Promise<Map<number, { num: string; session: string }>> {
    const { texteMapping } = await this.getAmeliMappings();
    return texteMapping;
  }

  // ===========================================================================
  // FETCH AMENDEMENTS FROM CSV
  // ===========================================================================

  /**
   * Fetch amendements for a single texte from its CSV on senat.fr.
   * Returns all amendments (commission + séance) for that texte.
   */
  async fetchCsvForTexte(
    texteId: number,
    texteNum: string,
    session: string
  ): Promise<TransformedAmendementSenat[]> {
    const url = `https://www.senat.fr/amendements/${session}/${texteNum}/jeu_complet_${session}_${texteNum}.csv`;

    try {
      const response = await axios({
        method: 'GET',
        url,
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'CLAIR-Bot/1.0 (https://github.com/clair)',
        },
        validateStatus: (status) => status < 500,
      });

      if (response.status === 404) {
        logger.debug({ texteId, texteNum, session }, 'No CSV for texte (404)');
        return [];
      }

      if (response.status !== 200) {
        logger.warn({ texteId, texteNum, session, status: response.status }, 'Unexpected HTTP status for CSV');
        return [];
      }

      // Decode latin1
      const decoder = new TextDecoder('latin1');
      const raw = decoder.decode(response.data);
      const lines = raw.split(/\r?\n/);

      // Line 1: "sep=" directive → skip
      // Line 2: headers
      // Lines 3+: data
      if (lines.length < 3) return [];

      // Skip "sep=" line if present
      let headerIdx = 0;
      if (lines[0]?.startsWith('sep=')) {
        headerIdx = 1;
      }

      const headers = lines[headerIdx]!.split('\t').map(h => h.trim());
      const colIdx = {
        nature: headers.indexOf('Nature'),
        numero: headers.indexOf('Numéro'),
        subdivision: headers.indexOf('Subdivision'),
        alinea: headers.indexOf('Alinéa'),
        auteur: headers.indexOf('Auteur'),
        auNomDe: headers.indexOf('Au nom de'),
        dateDepot: headers.indexOf('Date de dépôt'),
        dispositif: headers.indexOf('Dispositif'),
        objet: headers.indexOf('Objet'),
        sort: headers.indexOf('Sort'),
        dateSort: headers.indexOf('Date de saisie du sort'),
        urlAmendement: headers.indexOf('Url amendement'),
        ficheSenateur: headers.indexOf('Fiche Sénateur'),
      };

      if (colIdx.numero === -1) {
        logger.warn({ texteId, texteNum, headers: headers.join('|') }, 'Missing "Numéro" column in CSV');
        return [];
      }

      const results: TransformedAmendementSenat[] = [];

      for (let li = headerIdx + 1; li < lines.length; li++) {
        const line = lines[li]!;
        if (!line.trim()) continue;
        const cols = line.split('\t');

        const numero = (colIdx.numero >= 0 ? cols[colIdx.numero] : '')?.trim() || '';
        if (!numero) continue;

        const urlAmendement = (colIdx.urlAmendement >= 0 ? cols[colIdx.urlAmendement] : '')?.trim() || '';
        const auteur = (colIdx.auteur >= 0 ? cols[colIdx.auteur] : '')?.trim() || '';
        const auNomDe = (colIdx.auNomDe >= 0 ? cols[colIdx.auNomDe] : '')?.trim() || '';
        const dateDepotStr = (colIdx.dateDepot >= 0 ? cols[colIdx.dateDepot] : '')?.trim() || '';
        const dispositif = colIdx.dispositif >= 0 ? cols[colIdx.dispositif] || null : null;
        const objet = colIdx.objet >= 0 ? cols[colIdx.objet] || null : null;
        const sortStr = (colIdx.sort >= 0 ? cols[colIdx.sort] : '')?.trim() || null;
        const subdivision = (colIdx.subdivision >= 0 ? cols[colIdx.subdivision] : '')?.trim() || null;

        // Build UID from URL if available
        let uid: string;
        if (urlAmendement) {
          // URL format: //www.senat.fr/amendements/2025-2026/298/Amdt_4.html
          uid = `SENAT-AMD-S${session}-${texteNum}-${numero.replace(/\s+/g, '_')}`;
        } else {
          uid = `SENAT-AMD-T${texteId}-${numero.replace(/\s+/g, '_')}`;
        }

        // Parse auteur: "M. JADOT" → nom=JADOT
        let auteurNom: string | null = null;
        let auteurPrenom: string | null = null;
        const auteurMatch = auteur.match(/^(?:M\.|Mme|Mlle)\s+(.+)$/i);
        if (auteurMatch) {
          auteurNom = auteurMatch[1]!.trim();
        } else if (auteur) {
          auteurNom = auteur;
        }

        // Build auteurLibelle
        let auteurLibelle: string | null = auteur || null;
        if (auNomDe && auteurLibelle) {
          auteurLibelle += ` au nom de ${auNomDe}`;
        }

        // Parse dateDepot
        const dateDepot = parseDate(dateDepotStr || null);

        // Build sourceUrl
        const sourceUrl = urlAmendement
          ? (urlAmendement.startsWith('//') ? `https:${urlAmendement}` : urlAmendement)
          : null;

        results.push({
          uid,
          numero,
          dispositif: stripHtml(dispositif)?.substring(0, 5000) || null,
          exposeSommaire: stripHtml(objet)?.substring(0, 5000) || null,
          dateDepot,
          sort: mapCsvSort(sortStr),
          auteurNom,
          auteurPrenom,
          auteurMatricule: null, // CSV doesn't include matricule
          auteurLibelle,
          texteRef: `SENAT-TXT-${texteId}`,
          sourceUrl,
          articleVise: subdivision,
          cosignatairesMatricules: [],
        });
      }

      logger.debug({ texteId, texteNum, session, count: results.length }, 'CSV parsed');
      return results;

    } catch (error: any) {
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        logger.warn({ texteId, texteNum, session }, 'CSV fetch timeout');
      } else {
        logger.warn({ texteId, texteNum, session, error: error.message }, 'CSV fetch error');
      }
      return [];
    }
  }
}

export default SenatAmendementsClient;
