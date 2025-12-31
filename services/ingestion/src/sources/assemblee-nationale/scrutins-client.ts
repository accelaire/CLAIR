// =============================================================================
// Client Assemblée Nationale Open Data - Récupération des scrutins
// =============================================================================

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { logger } from '../../utils/logger';

// =============================================================================
// TYPES - Structure des données AN Scrutins
// =============================================================================

export interface ANScrutin {
  uid: string;
  numero: string;
  organeRef: string;
  legislature: string;
  sessionRef: string;
  seanceRef: string;
  dateScrutin: string;
  quantiemeJourSeance: string;
  typeVote: {
    codeTypeVote: string; // "SPO" (ordinaire), "SPS" (solennel), etc.
    libelleTypeVote: string;
    typeMajorite: string;
  };
  sort: {
    code: string; // "adopté", "rejeté"
    libelle: string;
  };
  titre: string;
  demandeur?: {
    texte: string;
    referenceLegislative?: string | null;
  };
  objet?: {
    libelle: string;
    dossierLegislatif?: string | null;
    referenceLegislative?: string | null;
  };
  modePublicationDesVotes: string;
  syntheseVote: {
    nombreVotants: string;
    suffragesExprimes: string;
    nbrSuffragesRequis: string;
    annonce: string;
    decompte: {
      nonVotants: string;
      pour: string;
      contre: string;
      abstentions: string;
      nonVotantsVolontaires: string;
    };
  };
  ventilationVotes: {
    organe: {
      organeRef: string;
      groupes: {
        groupe: ANGroupeVote[];
      };
    };
  };
  miseAuPoint?: {
    nonVotants?: ANVotant[] | null;
    pours?: ANVotant[] | null;
    contres?: ANVotant[] | null;
    abstentions?: ANVotant[] | null;
  };
  lieuVote: string;
}

export interface ANGroupeVote {
  organeRef: string;
  nombreMembresGroupe: string;
  vote: {
    positionMajoritaire: string;
    decompteVoix: {
      nonVotants: string;
      pour: string;
      contre: string;
      abstentions: string;
      nonVotantsVolontaires: string;
    };
    decompteNominatif?: {
      nonVotants?: { votant: ANVotant | ANVotant[] } | null;
      pours?: { votant: ANVotant | ANVotant[] } | null;
      contres?: { votant: ANVotant | ANVotant[] } | null;
      abstentions?: { votant: ANVotant | ANVotant[] } | null;
    };
  };
}

export interface ANVotant {
  acteurRef: string;
  mandatRef: string;
  parDelegation: string; // "true" | "false"
  numPlace?: string;
  causePositionVote?: string; // "PAN" (Président AN), "PSE" (Président Séance)
}

// =============================================================================
// TYPES TRANSFORMÉS (pour Prisma)
// =============================================================================

export interface TransformedScrutin {
  numero: number;
  date: Date;
  titre: string;
  typeVote: string; // 'ordinaire', 'solennel', 'motion'
  sort: string; // 'adopte', 'rejete'
  nombreVotants: number;
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
  sourceUrl: string;
  sourceData: ANScrutin;
}

export interface TransformedVote {
  acteurRef: string; // PA123456
  position: 'pour' | 'contre' | 'abstention' | 'absent';
  parDelegation: boolean;
}

export interface ScrutinWithVotes {
  scrutin: TransformedScrutin;
  votes: TransformedVote[];
}

// =============================================================================
// CLIENT
// =============================================================================

export class AssembleeNationaleScrutinsClient {
  private legislature: number;
  private baseUrl: string;

  constructor(legislature: number = 17) {
    this.legislature = legislature;
    this.baseUrl = 'https://data.assemblee-nationale.fr/static/openData/repository';
    logger.info({ legislature }, 'AssembleeNationaleScrutinsClient initialized');
  }

  // ===========================================================================
  // DOWNLOAD & EXTRACT HELPERS
  // ===========================================================================

  private async downloadFile(url: string, destPath: string): Promise<void> {
    logger.debug({ url, destPath }, 'Downloading file...');

    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      timeout: 180000,
      headers: {
        'User-Agent': 'CLAIR-Bot/1.0 (https://github.com/clair)',
        Accept: 'application/zip',
      },
    });

    const writer = createWriteStream(destPath);
    await pipeline(response.data, writer);

    logger.debug({ destPath }, 'File downloaded');
  }

  private async extractZip(zipPath: string, extractDir: string): Promise<void> {
    logger.debug({ zipPath, extractDir }, 'Extracting zip...');

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    await fs.promises.mkdir(extractDir, { recursive: true });

    try {
      await execAsync(`unzip -q -o "${zipPath}" -d "${extractDir}"`, {
        maxBuffer: 1024 * 1024 * 100,
      });
    } catch (error: any) {
      logger.error({ error: error.message }, 'unzip failed');
      throw new Error(`Zip extraction failed: ${error.message}`);
    }
  }

  // ===========================================================================
  // FETCH SCRUTINS
  // ===========================================================================

  async getScrutins(options: { limit?: number } = {}): Promise<ScrutinWithVotes[]> {
    const zipUrl = `${this.baseUrl}/${this.legislature}/loi/scrutins/Scrutins.json.zip`;
    const tempDir = path.join(os.tmpdir(), 'clair-scrutins-an');
    const zipPath = path.join(tempDir, 'scrutins.zip');
    const extractDir = path.join(tempDir, 'extracted');

    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      await fs.promises.mkdir(tempDir, { recursive: true });

      logger.info({ url: zipUrl }, 'Downloading scrutins archive...');
      await this.downloadFile(zipUrl, zipPath);

      const stats = await fs.promises.stat(zipPath);
      logger.info({ sizeMB: (stats.size / 1024 / 1024).toFixed(2) }, 'Archive downloaded');

      logger.info('Extracting archive...');
      await this.extractZip(zipPath, extractDir);

      // Charger les scrutins
      const jsonDir = path.join(extractDir, 'json');
      const scrutinFiles = await fs.promises.readdir(jsonDir);

      logger.info({ count: scrutinFiles.length }, 'Parsing scrutins...');

      const results: ScrutinWithVotes[] = [];
      let processed = 0;

      // Trier par numéro décroissant pour avoir les plus récents d'abord
      const sortedFiles = scrutinFiles
        .filter(f => f.endsWith('.json'))
        .sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, ''), 10);
          const numB = parseInt(b.replace(/\D/g, ''), 10);
          return numB - numA;
        });

      for (const file of sortedFiles) {
        if (options.limit && processed >= options.limit) break;

        try {
          const content = await fs.promises.readFile(path.join(jsonDir, file), 'utf-8');
          const data = JSON.parse(content);

          if (!data.scrutin) continue;

          const transformed = this.transformScrutin(data.scrutin);
          if (transformed) {
            results.push(transformed);
            processed++;
          }
        } catch (e: any) {
          logger.warn({ file, error: e.message }, 'Error parsing scrutin');
        }
      }

      logger.info({ scrutins: results.length }, 'Parsing completed');

      return results;

    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // ===========================================================================
  // TRANSFORMER
  // ===========================================================================

  private transformScrutin(scrutin: ANScrutin): ScrutinWithVotes | null {
    try {
      const numero = parseInt(scrutin.numero, 10);
      if (isNaN(numero)) return null;

      const date = new Date(scrutin.dateScrutin);
      if (isNaN(date.getTime())) return null;

      // Déterminer le type de vote
      let typeVote = 'ordinaire';
      const codeType = scrutin.typeVote?.codeTypeVote?.toUpperCase();
      if (codeType?.includes('SPS') || scrutin.typeVote?.libelleTypeVote?.toLowerCase().includes('solennel')) {
        typeVote = 'solennel';
      } else if (scrutin.titre?.toLowerCase().includes('motion de censure')) {
        typeVote = 'motion';
      }

      // Déterminer le sort
      let sort = 'rejete';
      const sortCode = scrutin.sort?.code?.toLowerCase();
      if (sortCode?.includes('adopt') || sortCode?.includes('approuv')) {
        sort = 'adopte';
      }

      const decompte = scrutin.syntheseVote?.decompte;
      const nombreVotants = parseInt(scrutin.syntheseVote?.nombreVotants || '0', 10);
      const nombrePour = parseInt(decompte?.pour || '0', 10);
      const nombreContre = parseInt(decompte?.contre || '0', 10);
      const nombreAbstention = parseInt(decompte?.abstentions || '0', 10);

      // Extraire les votes individuels
      const votes = this.extractVotes(scrutin);

      return {
        scrutin: {
          numero,
          date,
          titre: scrutin.titre || `Scrutin n°${numero}`,
          typeVote,
          sort,
          nombreVotants,
          nombrePour,
          nombreContre,
          nombreAbstention,
          sourceUrl: `https://www.assemblee-nationale.fr/dyn/${this.legislature}/scrutins/${scrutin.uid}`,
          sourceData: scrutin,
        },
        votes,
      };
    } catch (e: any) {
      logger.warn({ scrutinId: scrutin.uid, error: e.message }, 'Error transforming scrutin');
      return null;
    }
  }

  private extractVotes(scrutin: ANScrutin): TransformedVote[] {
    const votes: TransformedVote[] = [];

    const groupes = scrutin.ventilationVotes?.organe?.groupes?.groupe;
    if (!groupes) return votes;

    const groupeArray = Array.isArray(groupes) ? groupes : [groupes];

    for (const groupe of groupeArray) {
      const decompteNominatif = groupe.vote?.decompteNominatif;
      if (!decompteNominatif) continue;

      // Votes POUR
      if (decompteNominatif.pours?.votant) {
        const votants = Array.isArray(decompteNominatif.pours.votant)
          ? decompteNominatif.pours.votant
          : [decompteNominatif.pours.votant];

        for (const votant of votants) {
          if (votant?.acteurRef) {
            votes.push({
              acteurRef: votant.acteurRef,
              position: 'pour',
              parDelegation: votant.parDelegation === 'true',
            });
          }
        }
      }

      // Votes CONTRE
      if (decompteNominatif.contres?.votant) {
        const votants = Array.isArray(decompteNominatif.contres.votant)
          ? decompteNominatif.contres.votant
          : [decompteNominatif.contres.votant];

        for (const votant of votants) {
          if (votant?.acteurRef) {
            votes.push({
              acteurRef: votant.acteurRef,
              position: 'contre',
              parDelegation: votant.parDelegation === 'true',
            });
          }
        }
      }

      // Abstentions
      if (decompteNominatif.abstentions?.votant) {
        const votants = Array.isArray(decompteNominatif.abstentions.votant)
          ? decompteNominatif.abstentions.votant
          : [decompteNominatif.abstentions.votant];

        for (const votant of votants) {
          if (votant?.acteurRef) {
            votes.push({
              acteurRef: votant.acteurRef,
              position: 'abstention',
              parDelegation: votant.parDelegation === 'true',
            });
          }
        }
      }
    }

    return votes;
  }
}

export default AssembleeNationaleScrutinsClient;
