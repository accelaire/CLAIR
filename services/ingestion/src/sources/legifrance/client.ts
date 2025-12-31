// =============================================================================
// Client Légifrance/PISTE - Récupération des amendements
// =============================================================================

import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface LegifranceAmendement {
  uid: string;
  texteLegislatifRef: string;
  numAmend: string;
  urlAmend: string;
  designation: string;
  dateDepot: string;
  dateSort: string | null;
  sortAmend: string;
  auteur: {
    acteurRef: string;
    qualite: string;
  };
  auteurs?: {
    acteurRef: string;
    qualite: string;
  }[];
  dispositif: string;
  exposeSommaire: string;
  article: string | null;
}

export interface LegifranceActeur {
  uid: string;
  civilite: string;
  nom: string;
  prenom: string;
  profession: string | null;
}

export interface LegifranceSearchResult {
  amendements: LegifranceAmendement[];
  total: number;
  pageNumber: number;
  pageSize: number;
}

// =============================================================================
// CLIENT
// =============================================================================

export interface LegifranceClientConfig {
  clientId?: string;
  clientSecret?: string;
}

export class LegifranceClient {
  private http: AxiosInstance;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  // URLs Sandbox PISTE
  private oauthUrl = 'https://sandbox-oauth.piste.gouv.fr/api/oauth/token';
  private apiBaseUrl = 'https://sandbox-api.piste.gouv.fr/dila/legifrance/lf-engine-app';

  constructor(config: LegifranceClientConfig = {}) {
    this.clientId = config.clientId || process.env.LEGIFRANCE_CLIENT_ID || '';
    this.clientSecret = config.clientSecret || process.env.LEGIFRANCE_CLIENT_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      logger.warn('Légifrance credentials not configured');
    }

    this.http = axios.create({
      baseURL: this.apiBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    logger.info('LegifranceClient initialized (sandbox mode)');
  }

  // ===========================================================================
  // AUTHENTICATION
  // ===========================================================================

  private async getAccessToken(): Promise<string> {
    // Vérifier si le token est encore valide
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    logger.debug('Getting new Légifrance access token...');

    try {
      const response = await axios.post(
        this.oauthUrl,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'openid',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Token expire généralement en 1 heure, on rafraîchit à 50 minutes
      this.tokenExpiry = new Date(Date.now() + 50 * 60 * 1000);

      logger.debug('Légifrance access token obtained');
      return this.accessToken!;
    } catch (error: any) {
      logger.error({ error: error.message, response: error.response?.data }, 'Failed to get Légifrance access token');
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  private async request<T>(method: string, url: string, data?: any): Promise<T> {
    const token = await this.getAccessToken();

    try {
      // PISTE peut nécessiter l'en-tête KeyId avec le client_id
      const response = await this.http.request<T>({
        method,
        url,
        data,
        headers: {
          Authorization: `Bearer ${token}`,
          KeyId: this.clientId,
        },
      });
      return response.data;
    } catch (error: any) {
      logger.error({
        error: error.message,
        url,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
      }, 'Légifrance API error');
      throw error;
    }
  }

  // ===========================================================================
  // AMENDEMENTS - Assemblée Nationale Open Data
  // ===========================================================================

  // Note: L'API PISTE Légifrance ne fournit pas directement les amendements de l'AN.
  // On utilise l'API Open Data de l'Assemblée Nationale à la place.

  async getAmendementsAN(legislature: number = 16, limit: number = 100): Promise<any[]> {
    // L'Assemblée Nationale a une API Open Data pour les amendements
    const baseUrl = 'https://data.assemblee-nationale.fr/api/v2';

    try {
      const response = await axios.get(`${baseUrl}/amendements`, {
        params: {
          legislature,
          limit,
        },
        headers: {
          Accept: 'application/json',
        },
      });

      return response.data?.amendements || [];
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to fetch amendements from AN');
      // Fallback: essayer l'API Légifrance
      return this.searchAmendementsLegifrance(legislature, limit);
    }
  }

  // Recherche via l'API Légifrance (pour les textes de loi)
  async searchAmendementsLegifrance(legislature: number, limit: number): Promise<any[]> {
    try {
      // L'API Légifrance permet de rechercher dans les documents législatifs
      // Utilise le baseURL configuré (sandbox ou production)
      const result = await this.request<any>(
        'POST',
        '/search',
        {
          recherche: {
            champs: [
              {
                typeChamp: 'ALL',
                criteres: [
                  {
                    typeRecherche: 'UN_DES_MOTS',
                    valeur: 'amendement',
                    operateur: 'ET',
                  },
                ],
                operateur: 'ET',
              },
            ],
            filtres: [
              {
                facette: 'DATE_VERSION',
                valeur: {
                  debut: '2022-01-01',
                  fin: new Date().toISOString().split('T')[0],
                },
              },
            ],
            pageNumber: 1,
            pageSize: limit,
            sort: 'DATE_VERSION_DESC',
            typePagination: 'DEFAUT',
          },
        }
      );

      return result?.results || [];
    } catch (error: any) {
      logger.error({ error: error.message }, 'Légifrance search failed');
      return [];
    }
  }

  // ===========================================================================
  // ALTERNATIVE: Scraping de l'API de l'Assemblée Nationale
  // ===========================================================================

  async getAmendementsFromAN(textRef: string): Promise<any[]> {
    // API directe de l'Assemblée Nationale pour un texte spécifique
    const url = `https://www.assemblee-nationale.fr/dyn/16/amendements/${textRef}/json`;

    try {
      const response = await axios.get(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'CLAIR-Bot/1.0',
        },
      });

      return response.data?.amendements || [];
    } catch (error: any) {
      logger.debug({ textRef, error: error.message }, 'No amendements for this text');
      return [];
    }
  }

  // Tester la connexion à l'API
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const token = await this.getAccessToken();
      logger.info({ tokenLength: token.length }, 'OAuth token obtained successfully');

      // Essayer plusieurs endpoints pour trouver celui qui fonctionne
      // Fonds disponibles: ALL, JORF, CODE, LODA, CETAT, JURI, CONSTIT, KALI, ACCO, CNIL...
      const endpoints = [
        { method: 'POST', path: '/search', name: 'search LODA', data: {
          fond: 'LODA',
          recherche: {
            champs: [{
              typeChamp: 'ALL',
              criteres: [{ typeRecherche: 'UN_DES_MOTS', valeur: 'amendement', operateur: 'ET' }],
              operateur: 'ET'
            }],
            pageNumber: 1,
            pageSize: 1,
            typePagination: 'DEFAUT',
          },
        }},
        { method: 'POST', path: '/search', name: 'search JORF', data: {
          fond: 'JORF',
          recherche: {
            champs: [{
              typeChamp: 'ALL',
              criteres: [{ typeRecherche: 'UN_DES_MOTS', valeur: 'loi', operateur: 'ET' }],
              operateur: 'ET'
            }],
            pageNumber: 1,
            pageSize: 1,
            typePagination: 'DEFAUT',
          },
        }},
      ];

      for (const endpoint of endpoints) {
        try {
          logger.debug({ endpoint: endpoint.name }, 'Testing endpoint...');
          const result = await this.request<any>(endpoint.method, endpoint.path, endpoint.data);
          logger.info({ endpoint: endpoint.name, result: JSON.stringify(result).slice(0, 200) }, 'Endpoint OK');
          return {
            success: true,
            message: `Connexion réussie via ${endpoint.name}`,
          };
        } catch (e: any) {
          logger.debug({ endpoint: endpoint.name, error: e.message }, 'Endpoint failed, trying next...');
        }
      }

      return {
        success: false,
        message: 'Aucun endpoint accessible',
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Échec: ${error.message}`,
      };
    }
  }

  // Récupérer les amendements récents depuis l'AN Open Data
  async getRecentAmendements(limit: number = 500): Promise<any[]> {
    const url = 'https://www.assemblee-nationale.fr/dyn/opendata/AMENDEMENTS.json';

    try {
      logger.debug('Fetching recent amendements from AN Open Data...');
      const response = await axios.get(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'CLAIR-Bot/1.0',
        },
        timeout: 60000, // 60 secondes car le fichier peut être gros
      });

      const data = response.data;

      // Le format peut varier, essayons différentes structures
      if (Array.isArray(data)) {
        return data.slice(0, limit);
      }
      if (data?.amendements) {
        return data.amendements.slice(0, limit);
      }
      if (data?.export?.amendements) {
        const amendements = data.export.amendements;
        return Array.isArray(amendements.amendement)
          ? amendements.amendement.slice(0, limit)
          : [amendements.amendement].slice(0, limit);
      }

      logger.warn('Unknown amendements data structure');
      return [];
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to fetch AN Open Data');
      return [];
    }
  }
}

export default LegifranceClient;
