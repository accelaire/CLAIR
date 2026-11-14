// =============================================================================
// Client Assemblée Nationale Open Data - Organes historiques (AMO30)
// Source: AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip
// Contient ~10 800 organes ; après filtrage commissions/dérivés → ~2 990
// =============================================================================

import { LEGISLATURE_AN_COURANTE } from '../../workers/mandats';
import * as fs from 'fs';
import { logger } from '../../utils/logger.js';
import { errorMessage } from '../../utils/errors.js';
import { fichiersAMO30, repertoireAMO30 } from './amo30-archive';

// =============================================================================
// MAPPING codeType → type Commission
// Les codeTypes absents de cette map sont filtrés (CIRCONSCRIPTION, MINISTERE,
// GP, PARPOL, GOUVERNEMENT, ORGEXTPARL, PRESREP, HCJ, CONSTITU, CJR, etc.)
//
// EXCLUSIONS INTENTIONNELLES :
//   - GROUPESENAT : groupes politiques du Sénat → table groupes_politiques, pas commissions
// =============================================================================

const CODE_TYPE_MAP: Record<string, string> = {
  COMPER: 'permanente',
  COMSENAT: 'permanente',
  CNPE: 'enquete',
  CNPS: 'speciale',
  COMSPSENAT: 'speciale',
  CMP: 'mixte_paritaire',
  OFFPAR: 'office',
  DELEG: 'delegation',
  DELEGBUREAU: 'delegation',
  DELEGSENAT: 'delegation',
  MISINFO: 'mission_info',
  MISINFOCOM: 'mission_info',
  MISINFOPRE: 'mission_info',
  GE: 'groupe_etudes',
  GEVI: 'groupe_etudes',
  GA: 'groupe_amitie',
  API: 'assemblee_internationale',
  ASSEMBLEE: 'hemicycle',
  SENAT: 'hemicycle',
  COMNL: 'autre',
  BUREAU: 'autre',
  CONFPT: 'autre',
  // GROUPESENAT intentionnellement absent : ce sont des groupes politiques Sénat,
  // pas des commissions — ils appartiennent à la table groupes_politiques.
};

// codeTypes qui impliquent chambre = 'senat'
const SENAT_CODE_TYPES = new Set([
  'COMSENAT',
  'COMSPSENAT',
  'DELEGSENAT',
  'SENAT',
]);

// =============================================================================
// TYPES
// =============================================================================

/** Structure brute d'un organe dans AMO30 */
interface ANOrganeRaw {
  uid: string;
  codeType: string;
  libelle: string;
  libelleAbrev?: string | null;
  libelleAbrege?: string | null;
  viMoDe?: {
    /** Présent pour la plupart des types */
    dateDebut?: string | null;
    /** Utilisé à la place de dateDebut pour GA/GE/GEVI (groupes d'études et d'amitié) */
    dateAgrement?: string | null;
    dateFin?: string | null;
  } | null;
}

/** Un fichier JSON de l'archive AMO30 contient { "organe": { ... } } */
interface ANOrganeFile {
  organe: ANOrganeRaw;
}

export interface TransformedOrgane {
  uid: string;
  codeType: string;          // raw, utile pour debug
  type: string;              // permanente | enquete | speciale | …
  chambre: 'assemblee' | 'senat';
  libelle: string;
  libelleAbrev: string | null;
  libelleAbrege: string | null;
  dateDebut: Date;
  dateFin: Date | null;
  actif: boolean;            // true si dateFin null OU dateFin > now
}

// =============================================================================
// CLIENT
// =============================================================================

export class AssembleeNationaleOrganesClient {
  private legislature: number;

  constructor(legislature: number = LEGISLATURE_AN_COURANTE) {
    this.legislature = legislature;
    logger.info({ legislature }, 'AssembleeNationaleOrganesClient initialized');
  }

  // ===========================================================================
  // TRANSFORMER
  // ===========================================================================

  private transformOrgane(raw: ANOrganeRaw): TransformedOrgane | null {
    const mappedType = CODE_TYPE_MAP[raw.codeType];
    if (!mappedType) {
      // codeType non pertinent pour CLAIR → filtré
      return null;
    }

    const viMoDe = raw.viMoDe;
    const dateFin = viMoDe?.dateFin ? new Date(viMoDe.dateFin) : null;

    // GA/GE/GEVI ont dateDebut=null mais utilisent dateAgrement comme date de création
    const dateDebutRaw = viMoDe?.dateDebut ?? viMoDe?.dateAgrement;

    if (!dateDebutRaw) {
      logger.warn({ uid: raw.uid, codeType: raw.codeType }, 'Organe sans dateDebut ni dateAgrement — ignoré');
      return null;
    }

    const dateDebut = new Date(dateDebutRaw);
    if (isNaN(dateDebut.getTime())) {
      logger.warn({ uid: raw.uid, dateDebut: dateDebutRaw }, 'dateDebut invalide — ignoré');
      return null;
    }

    const chambre: 'assemblee' | 'senat' = SENAT_CODE_TYPES.has(raw.codeType)
      ? 'senat'
      : 'assemblee';

    const now = new Date();
    const actif = dateFin === null || dateFin > now;

    return {
      uid: raw.uid,
      codeType: raw.codeType,
      type: mappedType,
      chambre,
      libelle: raw.libelle,
      libelleAbrev: raw.libelleAbrev ?? null,
      libelleAbrege: raw.libelleAbrege ?? null,
      dateDebut,
      dateFin,
      actif,
    };
  }

  // ===========================================================================
  // MÉTHODE PRINCIPALE
  // ===========================================================================

  /** Les organes de l'archive, téléchargée une seule fois par processus (`amo30-archive`). */
  async getOrganes(): Promise<TransformedOrgane[]> {
    const json = await repertoireAMO30(this.legislature);
    const jsonFiles = await fichiersAMO30(json, 'organe');
    logger.info({ totalFiles: jsonFiles.length }, 'JSON files found in AMO30');

    const organes: TransformedOrgane[] = [];
    let totalParsed = 0;
    let totalFiltered = 0;
    let parseErrors = 0;

    for (const jsonFile of jsonFiles) {
      try {
        const content = await fs.promises.readFile(jsonFile, 'utf-8');
        const data = JSON.parse(content) as ANOrganeFile;

        if (!data?.organe) continue;

        totalParsed++;
        const transformed = this.transformOrgane(data.organe);

        if (transformed) {
          organes.push(transformed);
        } else {
          totalFiltered++;
        }

        if (totalParsed % 1000 === 0) {
          logger.debug(
            { parsed: totalParsed, kept: organes.length, filtered: totalFiltered },
            'AMO30 parsing progress',
          );
        }
      } catch (e) {
        parseErrors++;
        logger.warn({ file: jsonFile, error: errorMessage(e) }, 'Failed to parse organe file');
      }
    }

    logger.info(
      {
        totalFiles: jsonFiles.length,
        totalParsed,
        kept: organes.length,
        filtered: totalFiltered,
        parseErrors,
      },
      'AMO30 parsing complete',
    );

    return organes;
  }
}

export default AssembleeNationaleOrganesClient;
