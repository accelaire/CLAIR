// =============================================================================
// Client Sénat - Récupération des scrutins
// Source: https://www.senat.fr/scrutin-public/
// =============================================================================

import axios from 'axios';
import { logger } from '../../utils/logger';

// =============================================================================
// TYPES - Structure des données Sénat Scrutins
// =============================================================================

export interface SenatScrutinVote {
  matricule: string; // ID du sénateur
  vote: string;      // 'p' (pour), 'c' (contre), 'a' (abstention), 'n' (non votant)
  siege: number;     // Numéro de siège
}

export interface SenatScrutinJson {
  votes: SenatScrutinVote[];
}

// =============================================================================
// TYPES TRANSFORMÉS
// =============================================================================

export interface TransformedScrutinSenat {
  numero: number;
  chambre: 'senat';
  date: Date;
  titre: string;
  typeVote: string;
  sort: string; // 'adopte' | 'rejete'
  nombreVotants: number;
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
  sourceUrl: string;
  sourceData: object;
}

export interface TransformedVoteSenat {
  matricule: string;  // Sénateur matricule
  position: 'pour' | 'contre' | 'abstention' | 'absent';
  parDelegation: boolean;
}

export interface ScrutinSenatWithVotes {
  scrutin: TransformedScrutinSenat;
  votes: TransformedVoteSenat[];
}

// =============================================================================
// CLIENT
// =============================================================================

export class SenatScrutinsClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = 'https://www.senat.fr';
    logger.info('SenatScrutinsClient initialized');
  }

  // ===========================================================================
  // FETCH SCRUTINS
  // ===========================================================================

  async getScrutins(options: { limit?: number; session?: string } = {}): Promise<ScrutinSenatWithVotes[]> {
    const session = options.session || '2024';
    const indexUrl = `${this.baseUrl}/scrutin-public/scr${session}.html`;

    logger.info({ session, limit: options.limit }, 'Fetching scrutins list from Sénat...');

    try {
      // Étape 1: Récupérer la liste des scrutins depuis la page HTML
      const indexResponse = await axios.get(indexUrl, {
        timeout: 60000,
        headers: {
          'User-Agent': 'CLAIR-Bot/1.0 (https://github.com/clair)',
          Accept: 'text/html',
        },
      });

      const html = indexResponse.data;
      const scrutinLinks = this.extractScrutinLinks(html, session);

      logger.info({ count: scrutinLinks.length }, 'Found scrutin links');

      // Limiter si demandé
      const linksToProcess = options.limit ? scrutinLinks.slice(0, options.limit) : scrutinLinks;

      const results: ScrutinSenatWithVotes[] = [];

      // Étape 2: Pour chaque scrutin, récupérer le JSON des votes et le HTML pour les métadonnées
      for (const link of linksToProcess) {
        try {
          const scrutinResult = await this.fetchScrutin(link, session);
          if (scrutinResult) {
            results.push(scrutinResult);
          }
        } catch (error: any) {
          logger.warn({ link, error: error.message }, 'Error fetching scrutin');
        }
      }

      logger.info({ scrutins: results.length }, 'Scrutins Sénat parsing completed');
      return results;

    } catch (error: any) {
      logger.error({ session, error: error.message }, 'Failed to fetch scrutins list');
      throw error;
    }
  }

  private extractScrutinLinks(html: string, session: string): string[] {
    const pattern = new RegExp(`scr${session}-(\\d+)\\.html`, 'g');
    const matches = html.matchAll(pattern);
    const numbers = new Set<number>();

    for (const match of matches) {
      if (match[1]) {
        numbers.add(parseInt(match[1], 10));
      }
    }

    // Trier par numéro décroissant (plus récent en premier)
    return Array.from(numbers)
      .sort((a, b) => b - a)
      .map(n => `scr${session}-${n}`);
  }

  private async fetchScrutin(scrutinId: string, session: string): Promise<ScrutinSenatWithVotes | null> {
    const jsonUrl = `${this.baseUrl}/scrutin-public/${session}/${scrutinId}.json`;
    const htmlUrl = `${this.baseUrl}/scrutin-public/${session}/${scrutinId}.html`;

    // Extraire le numéro du scrutin
    const match = scrutinId.match(/scr\d+-(\d+)/);
    if (!match) return null;
    const numero = parseInt(match[1], 10);

    try {
      // Récupérer les votes en JSON
      const jsonResponse = await axios.get<SenatScrutinJson>(jsonUrl, {
        timeout: 30000,
        headers: {
          'User-Agent': 'CLAIR-Bot/1.0',
          Accept: 'application/json',
        },
      });

      const votesData = jsonResponse.data.votes || [];

      // Récupérer les métadonnées depuis le HTML
      const htmlResponse = await axios.get(htmlUrl, {
        timeout: 30000,
        headers: {
          'User-Agent': 'CLAIR-Bot/1.0',
          Accept: 'text/html',
        },
      });

      const metadata = this.parseScrutinHtml(htmlResponse.data, numero);

      // Transformer les votes
      const votes: TransformedVoteSenat[] = [];
      let nombrePour = 0;
      let nombreContre = 0;
      let nombreAbstention = 0;

      for (const v of votesData) {
        let position: 'pour' | 'contre' | 'abstention' | 'absent';
        switch (v.vote) {
          case 'p':
            position = 'pour';
            nombrePour++;
            break;
          case 'c':
            position = 'contre';
            nombreContre++;
            break;
          case 'a':
            position = 'abstention';
            nombreAbstention++;
            break;
          default:
            position = 'absent';
        }

        votes.push({
          matricule: v.matricule,
          position,
          parDelegation: false, // Non disponible dans les données Sénat
        });
      }

      const nombreVotants = nombrePour + nombreContre + nombreAbstention;

      return {
        scrutin: {
          numero,
          chambre: 'senat',
          date: metadata.date,
          titre: metadata.titre,
          typeVote: 'ordinaire', // Le Sénat n'indique pas toujours le type
          sort: metadata.sort,
          nombreVotants,
          nombrePour,
          nombreContre,
          nombreAbstention,
          sourceUrl: htmlUrl,
          sourceData: { votesData, metadata },
        },
        votes,
      };

    } catch (error: any) {
      logger.debug({ scrutinId, error: error.message }, 'Scrutin fetch failed');
      return null;
    }
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&deg;/g, '°')
      // Minuscules
      .replace(/&eacute;/gi, 'é')
      .replace(/&egrave;/gi, 'è')
      .replace(/&ecirc;/gi, 'ê')
      .replace(/&euml;/gi, 'ë')
      .replace(/&agrave;/gi, 'à')
      .replace(/&acirc;/gi, 'â')
      .replace(/&auml;/gi, 'ä')
      .replace(/&ugrave;/gi, 'ù')
      .replace(/&ucirc;/gi, 'û')
      .replace(/&uuml;/gi, 'ü')
      .replace(/&icirc;/gi, 'î')
      .replace(/&iuml;/gi, 'ï')
      .replace(/&ocirc;/gi, 'ô')
      .replace(/&ouml;/gi, 'ö')
      .replace(/&ccedil;/gi, 'ç')
      .replace(/&oelig;/gi, 'œ')
      .replace(/&aelig;/gi, 'æ')
      // Majuscules (résultat en majuscule)
      .replace(/&Eacute;/g, 'É')
      .replace(/&Egrave;/g, 'È')
      .replace(/&Ecirc;/g, 'Ê')
      .replace(/&Agrave;/g, 'À')
      .replace(/&Acirc;/g, 'Â')
      .replace(/&Ugrave;/g, 'Ù')
      .replace(/&Ucirc;/g, 'Û')
      .replace(/&Icirc;/g, 'Î')
      .replace(/&Ocirc;/g, 'Ô')
      .replace(/&Ccedil;/g, 'Ç')
      .replace(/&OElig;/g, 'Œ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private parseScrutinHtml(html: string, numero: number): { titre: string; date: Date; sort: string } {
    // Extraire le titre depuis le lead
    let titre = `Scrutin n°${numero}`;
    const leadMatch = html.match(/<p class="page-lead">([\s\S]*?)<\/p>/i);
    if (leadMatch && leadMatch[1]) {
      titre = this.decodeHtmlEntities(leadMatch[1]);
    }

    // Extraire la date depuis le titre de la page ou d'autres sources
    let date = new Date();
    const dateMatch = html.match(/(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i);
    if (dateMatch) {
      const months: Record<string, number> = {
        janvier: 0, février: 1, mars: 2, avril: 3, mai: 4, juin: 5,
        juillet: 6, août: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11
      };
      const day = parseInt(dateMatch[1], 10);
      const month = months[dateMatch[2].toLowerCase()] ?? 0;
      const year = parseInt(dateMatch[3], 10);
      date = new Date(year, month, day);
    }

    // Déterminer si adopté ou rejeté
    let sort = 'rejete';
    if (html.toLowerCase().includes('adopté') || html.toLowerCase().includes('adopt&eacute;')) {
      sort = 'adopte';
    }

    return { titre, date, sort };
  }
}

export default SenatScrutinsClient;
