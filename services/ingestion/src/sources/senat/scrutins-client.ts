// =============================================================================
// Client Sénat - Récupération des scrutins
// Source principale: DOSLEG (data.senat.fr)
// Enrichissement: HTML scraping pour dossier législatif
// =============================================================================

import axios from 'axios';
import { logger } from '../../utils/logger';
import { DoslegClient, TransformedDoslegScrutin, TransformedDoslegVote } from './dosleg-client';

// =============================================================================
// TYPES - Structure des données Sénat Scrutins
// =============================================================================

export interface TransformedScrutinSenat {
  numero: number;
  chambre: 'senat';
  session: string;       // Format "2024-2025"
  date: Date;
  titre: string;
  typeVote: string;
  sort: string;          // 'adopte' | 'rejete'
  nombreVotants: number;
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
  // Enrichissement contexte
  objetLibelle: string | null;
  demandeurTexte: string | null;
  seanceRef: string | null;
  // Liens
  dossierRef: string | null;       // Ref dossier législatif (ex: "pjlf2025")
  amendementsNumeros: string[];    // Numéros d'amendements liés
  sourceUrl: string;
  sourceData: object;
}

export interface TransformedVoteSenat {
  matricule: string;
  position: 'pour' | 'contre' | 'abstention' | 'absent';
  parDelegation: boolean;
}

export interface ScrutinSenatWithVotes {
  scrutin: TransformedScrutinSenat;
  votes: TransformedVoteSenat[];
}

// =============================================================================
// CONFIG
// =============================================================================

const SENAT_SESSION_START = parseInt(process.env.SENAT_SESSION_START || '2020', 10);
const SENAT_SESSION_END = parseInt(process.env.SENAT_SESSION_END || String(new Date().getFullYear()), 10);

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extrait le lien dossier législatif depuis la page HTML du scrutin
 */
async function fetchDossierRef(scrutinUrl: string): Promise<string | null> {
  try {
    const response = await axios.get(scrutinUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'CLAIR-Bot/1.0',
        Accept: 'text/html',
      },
    });

    const html = response.data;

    // Pattern: href="/dossier-legislatif/xxx.html"
    const match = html.match(/href="\/dossier-legislatif\/([^"]+)\.html"/);
    if (match && match[1]) {
      return match[1]; // Ex: "pjlf2025", "ppl23-479"
    }

    return null;
  } catch (error: any) {
    logger.debug({ url: scrutinUrl, error: error.message }, 'Failed to fetch dossier ref');
    return null;
  }
}

/**
 * Convertit la session format "2024-2025" vers l'année simple "2024"
 */
function sessionToYear(session: string): string {
  return session.split('-')[0] || session;
}

// =============================================================================
// CLIENT
// =============================================================================

export class SenatScrutinsClient {
  private doslegClient: DoslegClient;

  constructor() {
    this.doslegClient = new DoslegClient();
    logger.info({
      sessionStart: SENAT_SESSION_START,
      sessionEnd: SENAT_SESSION_END
    }, 'SenatScrutinsClient initialized (DOSLEG mode)');
  }

  // ===========================================================================
  // FETCH SCRUTINS FROM DOSLEG
  // ===========================================================================

  async getScrutins(options: {
    limit?: number;
    session?: string;
    sessions?: string[];
    enrichDossiers?: boolean;
    parallelEnrichment?: number;
  } = {}): Promise<ScrutinSenatWithVotes[]> {
    const enrichDossiers = options.enrichDossiers ?? true;
    const parallelEnrichment = options.parallelEnrichment ?? 5;

    // Determine session range
    let sessionStart = SENAT_SESSION_START;
    let sessionEnd = SENAT_SESSION_END;

    if (options.session) {
      // Single session specified (format: "2024" or "2024-2025")
      const year = parseInt(sessionToYear(options.session), 10);
      sessionStart = year;
      sessionEnd = year;
    } else if (options.sessions && options.sessions.length > 0) {
      // Multiple sessions specified
      const years = options.sessions.map(s => parseInt(sessionToYear(s), 10));
      sessionStart = Math.min(...years);
      sessionEnd = Math.max(...years);
    }

    logger.info({
      sessionStart,
      sessionEnd,
      limit: options.limit,
      enrichDossiers
    }, 'Fetching scrutins from DOSLEG...');

    // Fetch from DOSLEG
    const { scrutins: doslegScrutins, votes: doslegVotes } = await this.doslegClient.getScrutinsAndVotes({
      sessionStart,
      sessionEnd,
      limit: options.limit,
    });

    logger.info({
      scrutins: doslegScrutins.length,
      votes: doslegVotes.length
    }, 'DOSLEG data fetched');

    // Group votes by scrutin
    const votesByScrutin = new Map<string, TransformedDoslegVote[]>();
    for (const vote of doslegVotes) {
      const key = `${vote.scrutinSession}-${vote.scrutinNumero}`;
      const existing = votesByScrutin.get(key) || [];
      existing.push(vote);
      votesByScrutin.set(key, existing);
    }

    // Transform to output format
    const results: ScrutinSenatWithVotes[] = [];

    // Process scrutins (with optional dossier enrichment)
    const toEnrich = enrichDossiers ? doslegScrutins : [];
    const enrichedDossiers = new Map<string, string | null>();

    // Batch enrich dossiers in parallel
    if (enrichDossiers && toEnrich.length > 0) {
      logger.info({ count: toEnrich.length, parallel: parallelEnrichment }, 'Enriching scrutins with dossier links...');

      for (let i = 0; i < toEnrich.length; i += parallelEnrichment) {
        const batch = toEnrich.slice(i, i + parallelEnrichment);

        const batchResults = await Promise.all(
          batch.map(async (scr) => {
            const dossierRef = await fetchDossierRef(scr.sourceUrl);
            return { url: scr.sourceUrl, dossierRef };
          })
        );

        for (const { url, dossierRef } of batchResults) {
          enrichedDossiers.set(url, dossierRef);
        }

        // Progress log
        if ((i + parallelEnrichment) % 50 === 0 || i + parallelEnrichment >= toEnrich.length) {
          logger.debug({
            progress: Math.min(i + parallelEnrichment, toEnrich.length),
            total: toEnrich.length
          }, 'Enrichment progress...');
        }

        // Small pause to be nice to the server
        if (i + parallelEnrichment < toEnrich.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      const enrichedCount = [...enrichedDossiers.values()].filter(v => v !== null).length;
      logger.info({ enriched: enrichedCount, total: toEnrich.length }, 'Dossier enrichment completed');
    }

    // Build final results
    for (const scr of doslegScrutins) {
      const key = `${scr.session}-${scr.numero}`;
      const scrutinVotes = votesByScrutin.get(key) || [];
      const dossierRef = enrichedDossiers.get(scr.sourceUrl) ?? null;

      const transformedScrutin: TransformedScrutinSenat = {
        numero: scr.numero,
        chambre: 'senat',
        session: scr.session,
        date: scr.date,
        titre: scr.titre,
        typeVote: 'ordinaire', // DOSLEG doesn't distinguish types
        sort: scr.sort,
        nombreVotants: scr.nombreVotants,
        nombrePour: scr.nombrePour,
        nombreContre: scr.nombreContre,
        nombreAbstention: scr.nombreAbstention,
        objetLibelle: scr.titre,
        demandeurTexte: scr.demandeurTexte,
        seanceRef: null, // Could be extracted from DOSLEG code field if needed
        dossierRef,
        amendementsNumeros: scr.amendementsNumeros,
        sourceUrl: scr.sourceUrl,
        sourceData: {
          session: scr.session,
          amendementsNumeros: scr.amendementsNumeros,
          dossierRef,
        },
      };

      const transformedVotes: TransformedVoteSenat[] = scrutinVotes.map(v => ({
        matricule: v.senmatricule,
        position: v.position,
        parDelegation: false, // Not available in DOSLEG
      }));

      results.push({
        scrutin: transformedScrutin,
        votes: transformedVotes,
      });
    }

    logger.info({ scrutins: results.length }, 'Scrutins Sénat processing completed');
    return results;
  }

  // ===========================================================================
  // LEGACY METHOD - For backward compatibility
  // Fetches a single session using HTML scraping (deprecated)
  // ===========================================================================

  async getScrutinsLegacy(options: { limit?: number; session?: string } = {}): Promise<ScrutinSenatWithVotes[]> {
    logger.warn('Using legacy HTML scraping method - consider migrating to DOSLEG');

    const session = options.session || String(new Date().getFullYear());
    const baseUrl = 'https://www.senat.fr';
    const indexUrl = `${baseUrl}/scrutin-public/scr${session}.html`;

    try {
      const indexResponse = await axios.get(indexUrl, {
        timeout: 60000,
        headers: {
          'User-Agent': 'CLAIR-Bot/1.0',
          Accept: 'text/html',
        },
      });

      const html = indexResponse.data;
      const pattern = new RegExp(`scr${session}-(\\d+)\\.html`, 'g');
      const matches = html.matchAll(pattern);
      const numbers = new Set<number>();

      for (const match of matches) {
        if (match[1]) {
          numbers.add(parseInt(match[1], 10));
        }
      }

      const scrutinIds = Array.from(numbers)
        .sort((a, b) => b - a)
        .slice(0, options.limit || undefined)
        .map(n => `scr${session}-${n}`);

      const results: ScrutinSenatWithVotes[] = [];

      for (const scrutinId of scrutinIds) {
        try {
          const result = await this.fetchSingleScrutinLegacy(scrutinId, session, baseUrl);
          if (result) {
            results.push(result);
          }
        } catch (error: any) {
          logger.warn({ scrutinId, error: error.message }, 'Error fetching scrutin');
        }
      }

      return results;

    } catch (error: any) {
      logger.error({ session, error: error.message }, 'Failed to fetch scrutins list');
      throw error;
    }
  }

  private async fetchSingleScrutinLegacy(
    scrutinId: string,
    session: string,
    baseUrl: string
  ): Promise<ScrutinSenatWithVotes | null> {
    const jsonUrl = `${baseUrl}/scrutin-public/${session}/${scrutinId}.json`;
    const htmlUrl = `${baseUrl}/scrutin-public/${session}/${scrutinId}.html`;

    const match = scrutinId.match(/scr\d+-(\d+)/);
    if (!match) return null;
    const numero = parseInt(match[1], 10);

    try {
      const [jsonResponse, htmlResponse] = await Promise.all([
        axios.get(jsonUrl, { timeout: 30000, headers: { 'User-Agent': 'CLAIR-Bot/1.0' } }),
        axios.get(htmlUrl, { timeout: 30000, headers: { 'User-Agent': 'CLAIR-Bot/1.0' } }),
      ]);

      const votesData = jsonResponse.data.votes || [];
      const metadata = this.parseScrutinHtml(htmlResponse.data, numero);

      const votes: TransformedVoteSenat[] = [];
      let nombrePour = 0, nombreContre = 0, nombreAbstention = 0;

      for (const v of votesData) {
        let position: 'pour' | 'contre' | 'abstention' | 'absent';
        switch (v.vote) {
          case 'p': position = 'pour'; nombrePour++; break;
          case 'c': position = 'contre'; nombreContre++; break;
          case 'a': position = 'abstention'; nombreAbstention++; break;
          default: position = 'absent';
        }
        votes.push({ matricule: v.matricule, position, parDelegation: false });
      }

      return {
        scrutin: {
          numero,
          chambre: 'senat',
          session: `${session}-${parseInt(session) + 1}`,
          date: metadata.date,
          titre: metadata.titre,
          typeVote: 'ordinaire',
          sort: metadata.sort,
          nombreVotants: nombrePour + nombreContre + nombreAbstention,
          nombrePour,
          nombreContre,
          nombreAbstention,
          objetLibelle: metadata.titre,
          demandeurTexte: null,
          seanceRef: null,
          dossierRef: metadata.dossierRef,
          amendementsNumeros: [],
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

  private parseScrutinHtml(html: string, numero: number): {
    titre: string;
    date: Date;
    sort: string;
    dossierRef: string | null;
  } {
    // Decode HTML entities
    const decoded = html
      .replace(/&eacute;/gi, 'é')
      .replace(/&egrave;/gi, 'è')
      .replace(/&agrave;/gi, 'à')
      .replace(/&ccedil;/gi, 'ç')
      .replace(/&deg;/g, '°')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&');

    // Extract title
    let titre = `Scrutin n°${numero}`;
    const leadMatch = html.match(/<p class="page-lead">([\s\S]*?)<\/p>/i);
    if (leadMatch && leadMatch[1]) {
      titre = leadMatch[1].replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Extract date
    let date: Date | null = null;
    const dateMatch = decoded.match(/(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i);
    if (dateMatch) {
      const months: Record<string, number> = {
        janvier: 0, février: 1, mars: 2, avril: 3, mai: 4, juin: 5,
        juillet: 6, août: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11
      };
      date = new Date(parseInt(dateMatch[3]), months[dateMatch[2].toLowerCase()], parseInt(dateMatch[1]));
    }

    if (!date) {
      throw new Error(`Failed to parse date for scrutin n°${numero}`);
    }

    // Extract sort
    const sort = decoded.toLowerCase().includes('adopté') ? 'adopte' : 'rejete';

    // Extract dossier ref
    let dossierRef: string | null = null;
    const dossierMatch = html.match(/href="\/dossier-legislatif\/([^"]+)\.html"/);
    if (dossierMatch && dossierMatch[1]) {
      dossierRef = dossierMatch[1];
    }

    return { titre, date, sort, dossierRef };
  }
}

export default SenatScrutinsClient;
