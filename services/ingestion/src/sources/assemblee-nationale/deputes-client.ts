// =============================================================================
// Client Assemblée Nationale Open Data - Récupération des députés
// =============================================================================

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { logger } from '../../utils/logger';

// =============================================================================
// TYPES - Structure des données AN
// =============================================================================

export interface ANActeur {
  uid: string | { '#text': string };
  etatCivil: {
    ident: {
      civ: string; // "M." | "Mme"
      prenom: string;
      nom: string;
      alpha: string; // Nom en majuscules
      trigramme: string;
    };
    infoNaissance: {
      dateNais: string;
      villeNais?: string;
      depNais?: string;
      paysNais?: string;
    };
    dateDeces?: { '@xsi:nil'?: string } | null;
  };
  profession?: {
    libelleCourant?: string;
  };
  uri_hatvp?: string;
  adresses?: {
    adresse: ANAdresse[];
  };
  mandats?: {
    mandat: ANMandat[];
  };
}

export interface ANAdresse {
  '@xsi:type': string;
  uid: string;
  type: string;
  typeLibelle: string;
  valElec?: string; // Pour email, twitter, etc.
  numeroRue?: string;
  nomRue?: string;
  codePostal?: string;
  ville?: string;
}

export interface ANMandat {
  '@xsi:type': string;
  uid: string;
  acteurRef: string;
  legislature?: string;
  typeOrgane: string; // "ASSEMBLEE", "GP", "COMPER", etc.
  dateDebut: string;
  dateFin?: string | null;
  infosQualite?: {
    codeQualite: string;
    libQualite: string;
  };
  organes?: {
    organeRef: string;
  };
  election?: {
    lieu: {
      region: string;
      departement: string;
      numDepartement: string;
      numCirco: string;
    };
    causeMandat: string;
    refCirconscription: string;
  };
}

export interface ANOrgane {
  uid: string;
  codeType: string;
  libelle: string;
  libelleAbrev?: string;
  libelleAbrege?: string;
  viMoDe?: {
    dateDebut: string;
    dateFin?: string;
  };
  couleurAssociee?: string;
  positionPolitique?: string;
}

// =============================================================================
// TYPES TRANSFORMÉS (pour Prisma)
// =============================================================================

export interface TransformedParlementaire {
  uid: string;
  slug: string;
  chambre: 'assemblee' | 'senat';
  nom: string;
  prenom: string;
  sexe: string;
  dateNaissance: Date | null;
  lieuNaissance: string | null;
  profession: string | null;
  email: string | null;
  twitter: string | null;
  facebook: string | null;
  photoUrl: string | null;
  // Relations
  groupeSigle: string | null;
  groupeRef: string | null;
  departement: string | null;
  numCirco: number | null;
  // Sénat spécifique
  serie: string | null;
  commissionPermanente: string | null;
  // Source
  sourceData: ANActeur;
}

// Alias pour compatibilité
export type TransformedDepute = TransformedParlementaire;

export interface TransformedGroupe {
  uid: string;
  slug: string;
  chambre: 'assemblee' | 'senat';
  nom: string;
  nomComplet: string;
  couleur: string | null;
  position: string | null;
}

// =============================================================================
// CLIENT
// =============================================================================

export class AssembleeNationaleDeputesClient {
  private legislature: number;
  private baseUrl: string;

  constructor(legislature: number = 17) {
    this.legislature = legislature;
    this.baseUrl = 'https://data.assemblee-nationale.fr/static/openData/repository';
    logger.info({ legislature }, 'AssembleeNationaleDeputesClient initialized');
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
      timeout: 120000,
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
  // FETCH ORGANES (pour les groupes politiques)
  // ===========================================================================

  async getOrganes(): Promise<Map<string, ANOrgane>> {
    const zipUrl = `${this.baseUrl}/${this.legislature}/amo/deputes_actifs_mandats_actifs_organes/AMO10_deputes_actifs_mandats_actifs_organes.json.zip`;
    const tempDir = path.join(os.tmpdir(), 'clair-organes');
    const zipPath = path.join(tempDir, 'organes.zip');
    const extractDir = path.join(tempDir, 'extracted');

    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      await fs.promises.mkdir(tempDir, { recursive: true });

      await this.downloadFile(zipUrl, zipPath);
      await this.extractZip(zipPath, extractDir);

      // Chercher les fichiers organe
      const organeDir = path.join(extractDir, 'json', 'organe');
      const organeMap = new Map<string, ANOrgane>();

      if (await fs.promises.access(organeDir).then(() => true).catch(() => false)) {
        const files = await fs.promises.readdir(organeDir);

        for (const file of files) {
          if (!file.endsWith('.json')) continue;

          try {
            const content = await fs.promises.readFile(path.join(organeDir, file), 'utf-8');
            const data = JSON.parse(content);

            if (data.organe) {
              const organe = data.organe;
              organeMap.set(organe.uid, {
                uid: organe.uid,
                codeType: organe.codeType,
                libelle: organe.libelle,
                libelleAbrev: organe.libelleAbrev,
                libelleAbrege: organe.libelleAbrege,
                viMoDe: organe.viMoDe,
                couleurAssociee: organe.couleurAssociee,
                positionPolitique: organe.positionPolitique,
              });
            }
          } catch (e) {
            // Ignorer les fichiers non valides
          }
        }
      }

      logger.info({ count: organeMap.size }, 'Organes loaded');
      return organeMap;

    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // ===========================================================================
  // FETCH DÉPUTÉS
  // ===========================================================================

  async getDeputes(): Promise<{ deputes: TransformedParlementaire[]; groupes: TransformedGroupe[] }> {
    const zipUrl = `${this.baseUrl}/${this.legislature}/amo/deputes_actifs_mandats_actifs_organes/AMO10_deputes_actifs_mandats_actifs_organes.json.zip`;
    const tempDir = path.join(os.tmpdir(), 'clair-deputes-an');
    const zipPath = path.join(tempDir, 'deputes.zip');
    const extractDir = path.join(tempDir, 'extracted');

    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      await fs.promises.mkdir(tempDir, { recursive: true });

      logger.info({ url: zipUrl }, 'Downloading députés archive...');
      await this.downloadFile(zipUrl, zipPath);

      const stats = await fs.promises.stat(zipPath);
      logger.info({ sizeMB: (stats.size / 1024 / 1024).toFixed(2) }, 'Archive downloaded');

      logger.info('Extracting archive...');
      await this.extractZip(zipPath, extractDir);

      // Charger les organes pour les groupes
      const organeDir = path.join(extractDir, 'json', 'organe');
      const organeMap = new Map<string, ANOrgane>();

      if (await fs.promises.access(organeDir).then(() => true).catch(() => false)) {
        const organeFiles = await fs.promises.readdir(organeDir);
        for (const file of organeFiles) {
          if (!file.endsWith('.json')) continue;
          try {
            const content = await fs.promises.readFile(path.join(organeDir, file), 'utf-8');
            const data = JSON.parse(content);
            if (data.organe) {
              organeMap.set(data.organe.uid, data.organe);
            }
          } catch (e) {}
        }
      }

      // Charger les députés
      const acteurDir = path.join(extractDir, 'json', 'acteur');
      const acteurFiles = await fs.promises.readdir(acteurDir);

      logger.info({ count: acteurFiles.length }, 'Parsing acteurs...');

      const deputes: TransformedDepute[] = [];
      const groupesMap = new Map<string, TransformedGroupe>();

      for (const file of acteurFiles) {
        if (!file.endsWith('.json')) continue;

        try {
          const content = await fs.promises.readFile(path.join(acteurDir, file), 'utf-8');
          const data = JSON.parse(content);

          if (!data.acteur) continue;

          const acteur: ANActeur = data.acteur;
          const transformed = this.transformActeur(acteur, organeMap);

          if (transformed) {
            deputes.push(transformed);

            // Collecter le groupe politique
            if (transformed.groupeRef && organeMap.has(transformed.groupeRef)) {
              const organe = organeMap.get(transformed.groupeRef)!;
              if (!groupesMap.has(organe.uid)) {
                groupesMap.set(organe.uid, this.transformOrganeToGroupe(organe));
              }
            }
          }
        } catch (e: any) {
          logger.warn({ file, error: e.message }, 'Error parsing acteur');
        }
      }

      logger.info({ deputes: deputes.length, groupes: groupesMap.size }, 'Parsing completed');

      return {
        deputes,
        groupes: Array.from(groupesMap.values()),
      };

    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // ===========================================================================
  // TRANSFORMERS
  // ===========================================================================

  private transformActeur(acteur: ANActeur, organeMap: Map<string, ANOrgane>): TransformedParlementaire | null {
    const ident = acteur.etatCivil?.ident;
    if (!ident) return null;

    // Extraire l'UID (peut être string ou objet avec #text)
    const uid = typeof acteur.uid === 'string' ? acteur.uid : acteur.uid['#text'];

    // Trouver le mandat de député actif
    const mandats = Array.isArray(acteur.mandats?.mandat)
      ? acteur.mandats.mandat
      : acteur.mandats?.mandat ? [acteur.mandats.mandat] : [];

    const mandatDepute = mandats.find(
      (m) => m.typeOrgane === 'ASSEMBLEE' &&
             m.legislature === String(this.legislature) &&
             !m.dateFin
    );

    if (!mandatDepute) return null; // Pas de mandat actif

    // Trouver le groupe politique actif
    const mandatGroupe = mandats.find(
      (m) => m.typeOrgane === 'GP' &&
             m.legislature === String(this.legislature) &&
             !m.dateFin
    );

    let groupeSigle: string | null = null;
    let groupeRef: string | null = null;

    if (mandatGroupe?.organes?.organeRef) {
      groupeRef = mandatGroupe.organes.organeRef;
      const organe = organeMap.get(groupeRef);
      if (organe) {
        groupeSigle = organe.libelleAbrev || organe.libelleAbrege || null;
      }
    }

    // Extraire les adresses
    const adresses = Array.isArray(acteur.adresses?.adresse)
      ? acteur.adresses.adresse
      : acteur.adresses?.adresse ? [acteur.adresses.adresse] : [];

    const emailAddr = adresses.find((a) => a.typeLibelle === 'Mèl' || a.type === '15');
    const twitterAddr = adresses.find((a) => a.typeLibelle === 'Twitter' || a.type === '24');

    // Construire le slug
    const slug = this.buildSlug(ident.prenom, ident.nom);

    // Extraire la circonscription depuis le mandat
    const election = mandatDepute.election;
    const departement = election?.lieu?.numDepartement || null;
    const numCirco = election?.lieu?.numCirco ? parseInt(election.lieu.numCirco, 10) : null;

    // Date de naissance
    let dateNaissance: Date | null = null;
    if (acteur.etatCivil?.infoNaissance?.dateNais) {
      const parsed = new Date(acteur.etatCivil.infoNaissance.dateNais);
      if (!isNaN(parsed.getTime())) {
        dateNaissance = parsed;
      }
    }

    return {
      uid,
      slug,
      chambre: 'assemblee' as const,
      nom: ident.nom,
      prenom: ident.prenom,
      sexe: ident.civ === 'Mme' ? 'F' : 'M',
      dateNaissance,
      lieuNaissance: acteur.etatCivil?.infoNaissance?.villeNais || null,
      profession: acteur.profession?.libelleCourant || null,
      email: emailAddr?.valElec || null,
      twitter: twitterAddr?.valElec?.replace('@', '') || null,
      facebook: null, // Non disponible pour AN
      // Format: https://www2.assemblee-nationale.fr/static/tribun/17/photos/793872.jpg
      // L'UID est au format "PA793872", on extrait le numéro
      photoUrl: `https://www2.assemblee-nationale.fr/static/tribun/${this.legislature}/photos/${uid.replace('PA', '')}.jpg`,
      groupeSigle,
      groupeRef,
      departement,
      numCirco,
      serie: null, // Sénateurs uniquement
      commissionPermanente: null, // Sénateurs uniquement
      sourceData: acteur,
    };
  }

  private transformOrganeToGroupe(organe: ANOrgane): TransformedGroupe {
    const slug = this.buildSlug(organe.libelleAbrev || organe.libelle);

    return {
      uid: organe.uid,
      slug,
      chambre: 'assemblee' as const,
      nom: organe.libelleAbrev || organe.libelleAbrege || organe.libelle,
      nomComplet: organe.libelle,
      couleur: organe.couleurAssociee || null,
      position: this.guessPosition(organe.libelle),
    };
  }

  private buildSlug(...parts: (string | null | undefined)[]): string {
    return parts
      .filter(Boolean)
      .join('-')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private guessPosition(nom: string): string {
    const nomLower = nom.toLowerCase();

    if (nomLower.includes('insoumis') || nomLower.includes('gauche démocrate') || nomLower.includes('communiste')) {
      return 'gauche';
    }
    if (nomLower.includes('socialiste') || nomLower.includes('écolog')) {
      return 'centre_gauche';
    }
    if (nomLower.includes('renaissance') || nomLower.includes('modem') || nomLower.includes('horizons') || nomLower.includes('ensemble')) {
      return 'centre';
    }
    if (nomLower.includes('républicains') || nomLower.includes('droite républicaine')) {
      return 'droite';
    }
    if (nomLower.includes('rassemblement national') || nomLower.includes('national')) {
      return 'extreme_droite';
    }

    return 'centre';
  }
}

export default AssembleeNationaleDeputesClient;
