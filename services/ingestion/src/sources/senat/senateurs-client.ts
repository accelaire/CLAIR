// =============================================================================
// Client Sénat - Récupération des sénateurs
// Source: https://www.senat.fr/api-senat/senateurs.json
// =============================================================================

import axios from 'axios';
import { logger } from '../../utils/logger';

// =============================================================================
// TYPES - Structure des données Sénat
// =============================================================================

export interface SenatSenateur {
  matricule: string;
  nom: string;
  prenom: string;
  tri: string;
  civilite: string; // "M." | "Mme"
  feminise: boolean;
  serie: string; // "1" | "2" | "3"
  siege: number;
  url: string;
  urlAvatar?: string;
  twitter?: string;
  facebook?: string;
  organismes?: SenatOrganisme[];
  groupe?: {
    code: string;
    libelle: string;
    ordre: number;
  };
  circonscription?: {
    code: string;
    libelle: string;
    ordre: number;
  };
  categorieProfessionnelle?: {
    code: string;
    libelle: string;
    ordre: number;
  };
}

export interface SenatOrganisme {
  code: string;
  type: string; // "COMMISSION", "DELEGATION/OFFICE", "ETUDE", etc.
  libelle: string;
  ordre: number;
}

// =============================================================================
// TYPES TRANSFORMÉS (pour Prisma - compatible avec TransformedParlementaire)
// =============================================================================

export interface TransformedSenateur {
  uid: string;
  slug: string;
  chambre: 'senat';
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
  sourceData: SenatSenateur;
}

export interface TransformedGroupeSenat {
  uid: string;
  slug: string;
  chambre: 'senat';
  nom: string;
  nomComplet: string;
  couleur: string | null;
  position: string | null;
}

// =============================================================================
// CLIENT
// =============================================================================

export class SenatSenateursClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = 'https://www.senat.fr';
    logger.info('SenatSenateursClient initialized');
  }

  // ===========================================================================
  // FETCH SÉNATEURS
  // ===========================================================================

  async getSenateurs(): Promise<{ senateurs: TransformedSenateur[]; groupes: TransformedGroupeSenat[] }> {
    const apiUrl = `${this.baseUrl}/api-senat/senateurs.json`;

    logger.info({ url: apiUrl }, 'Fetching sénateurs from Sénat API...');

    try {
      const response = await axios.get<SenatSenateur[]>(apiUrl, {
        timeout: 60000,
        headers: {
          'User-Agent': 'CLAIR-Bot/1.0 (https://github.com/clair)',
          Accept: 'application/json',
        },
      });

      const rawSenateurs = response.data;
      logger.info({ count: rawSenateurs.length }, 'Raw sénateurs fetched');

      const senateurs: TransformedSenateur[] = [];
      const groupesMap = new Map<string, TransformedGroupeSenat>();

      for (const raw of rawSenateurs) {
        const transformed = this.transformSenateur(raw);
        if (transformed) {
          senateurs.push(transformed);

          // Collecter le groupe politique
          if (raw.groupe) {
            if (!groupesMap.has(raw.groupe.code)) {
              groupesMap.set(raw.groupe.code, this.transformGroupe(raw.groupe));
            }
          }
        }
      }

      logger.info({ senateurs: senateurs.length, groupes: groupesMap.size }, 'Sénateurs parsing completed');

      return {
        senateurs,
        groupes: Array.from(groupesMap.values()),
      };

    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to fetch sénateurs');
      throw error;
    }
  }

  // ===========================================================================
  // TRANSFORMERS
  // ===========================================================================

  private transformSenateur(raw: SenatSenateur): TransformedSenateur | null {
    if (!raw.matricule || !raw.nom) return null;

    // Construire le slug
    const slug = this.buildSlug(raw.prenom, raw.nom);

    // Trouver la commission permanente
    const commission = raw.organismes?.find(o => o.type === 'COMMISSION');

    // Photo URL - format: /senimg/matricule_carre.jpg
    const photoUrl = raw.urlAvatar
      ? `${this.baseUrl}${raw.urlAvatar}`
      : null;

    // Département depuis la circonscription
    const departement = raw.circonscription?.code || null;

    return {
      uid: raw.matricule,
      slug,
      chambre: 'senat',
      nom: raw.nom,
      prenom: raw.prenom,
      sexe: raw.civilite === 'Mme' ? 'F' : 'M',
      dateNaissance: null, // Non disponible dans l'API
      lieuNaissance: null,
      profession: raw.categorieProfessionnelle?.libelle || null,
      email: null, // Non disponible dans l'API publique
      twitter: raw.twitter || null,
      facebook: raw.facebook || null,
      photoUrl,
      groupeSigle: raw.groupe?.code || null,
      groupeRef: raw.groupe?.code || null,
      departement,
      numCirco: null, // Les sénateurs n'ont pas de numéro de circo
      serie: raw.serie || null,
      commissionPermanente: commission?.libelle || null,
      sourceData: raw,
    };
  }

  private transformGroupe(groupe: { code: string; libelle: string; ordre: number }): TransformedGroupeSenat {
    const slug = this.buildSlug(groupe.code);

    return {
      uid: `SENAT-${groupe.code}`,
      slug,
      chambre: 'senat',
      nom: groupe.code,
      nomComplet: groupe.libelle,
      couleur: this.getGroupeColor(groupe.code),
      position: this.guessPosition(groupe.libelle),
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

  private getGroupeColor(code: string): string | null {
    const colors: Record<string, string> = {
      'LR': '#0066CC',      // Les Républicains
      'SOCR': '#FF6666',    // Socialiste
      'CRCE': '#CC0000',    // Communiste
      'RDSE': '#FF9900',    // Radical
      'UC': '#00AACC',      // Union Centriste
      'LREM': '#FFCC00',    // Renaissance/En Marche
      'RDPI': '#FFCC00',    // RDPI (Renaissance)
      'GEST': '#00CC00',    // Écologiste
      'INDEP': '#999999',   // Indépendants
      'NI': '#CCCCCC',      // Non inscrits
      'RN': '#0D378A',      // Rassemblement National
    };
    return colors[code] || null;
  }

  private guessPosition(libelle: string): string {
    const lib = libelle.toLowerCase();

    if (lib.includes('communiste') || lib.includes('crce')) {
      return 'gauche';
    }
    if (lib.includes('socialiste') || lib.includes('écolog')) {
      return 'centre_gauche';
    }
    if (lib.includes('radical') || lib.includes('rdse')) {
      return 'centre_gauche';
    }
    if (lib.includes('centriste') || lib.includes('union centriste')) {
      return 'centre';
    }
    if (lib.includes('renaissance') || lib.includes('progressiste') || lib.includes('rdpi') || lib.includes('indépendant')) {
      return 'centre';
    }
    if (lib.includes('républicain')) {
      return 'droite';
    }
    if (lib.includes('national') || lib.includes('reconquête')) {
      return 'extreme_droite';
    }

    return 'centre';
  }
}

export default SenatSenateursClient;
