// =============================================================================
// Plugin Meilisearch pour Fastify
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { MeiliSearch, Index } from 'meilisearch';
import { logger } from '../utils/logger';

// Types pour les documents indexés
export interface DeputeDocument {
  id: string;
  slug: string;
  chambre: string; // 'assemblee' | 'senat'
  nom: string;
  prenom: string;
  nomComplet: string;
  photoUrl: string | null;
  groupe: string | null;
  groupeCouleur: string | null;
  circonscription: string | null;
  departement: string | null;
  profession: string | null;
  actif: boolean;
}

export interface ScrutinDocument {
  id: string;
  numero: number;
  chambre: string; // 'assemblee' | 'senat'
  date: string;
  titre: string;
  sort: string;
  typeVote: string;
  importance: number;
  tags: string[];
  nombrePour: number;
  nombreContre: number;
}

export interface LobbyisteDocument {
  id: string;
  nom: string;
  type: string;
  secteur: string | null;
  budgetAnnuel: number | null;
  nbLobbyistes: number | null;
  ville: string | null;
}

declare module 'fastify' {
  interface FastifyInstance {
    meilisearch: MeiliSearch;
    meiliIndexes: {
      deputes: Index<DeputeDocument>;
      scrutins: Index<ScrutinDocument>;
      lobbyistes: Index<LobbyisteDocument>;
    };
  }
}

const INDEX_SETTINGS = {
  deputes: {
    searchableAttributes: ['nomComplet', 'nom', 'prenom', 'groupe', 'circonscription', 'departement', 'profession'],
    filterableAttributes: ['groupe', 'departement', 'actif', 'chambre'],
    sortableAttributes: ['nom', 'prenom'],
    displayedAttributes: ['id', 'slug', 'chambre', 'nom', 'prenom', 'nomComplet', 'photoUrl', 'groupe', 'groupeCouleur', 'circonscription', 'departement'],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: {
        oneTypo: 3,  // 1 typo autorisé pour les mots de 3+ lettres
        twoTypos: 6, // 2 typos autorisés pour les mots de 6+ lettres
      },
    },
  },
  scrutins: {
    searchableAttributes: ['titre', 'tags'],
    filterableAttributes: ['sort', 'typeVote', 'importance', 'tags', 'date'],
    sortableAttributes: ['date', 'importance', 'numero'],
    displayedAttributes: ['id', 'numero', 'chambre', 'date', 'titre', 'sort', 'typeVote', 'importance', 'tags', 'nombrePour', 'nombreContre'],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: {
        oneTypo: 3,
        twoTypos: 6,
      },
    },
  },
  lobbyistes: {
    searchableAttributes: ['nom', 'secteur', 'type', 'ville'],
    filterableAttributes: ['type', 'secteur'],
    sortableAttributes: ['nom', 'budgetAnnuel', 'nbLobbyistes'],
    displayedAttributes: ['id', 'nom', 'type', 'secteur', 'budgetAnnuel', 'nbLobbyistes', 'ville'],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: {
        oneTypo: 3,
        twoTypos: 6,
      },
    },
  },
};

const meilisearchPlugin: FastifyPluginAsync = async (fastify) => {
  const url = process.env.MEILISEARCH_URL || 'http://localhost:7700';
  const apiKey = process.env.MEILISEARCH_KEY || '';

  const client = new MeiliSearch({
    host: url,
    apiKey,
  });

  // Vérifier la connexion
  try {
    const health = await client.health();
    logger.info(`Meilisearch connected: ${health.status}`);
  } catch (error) {
    logger.warn('Meilisearch not available - search will use database fallback');
  }

  // Créer/obtenir les index
  const indexes = {
    deputes: client.index<DeputeDocument>('deputes'),
    scrutins: client.index<ScrutinDocument>('scrutins'),
    lobbyistes: client.index<LobbyisteDocument>('lobbyistes'),
  };

  // Configurer les index (en arrière-plan)
  configureIndexes(client).catch((err) => {
    logger.warn('Failed to configure Meilisearch indexes:', err.message);
  });

  fastify.decorate('meilisearch', client);
  fastify.decorate('meiliIndexes', indexes);
};

async function configureIndexes(client: MeiliSearch) {
  for (const [indexName, settings] of Object.entries(INDEX_SETTINGS)) {
    try {
      const index = client.index(indexName);
      await index.updateSettings(settings);
      logger.info(`Meilisearch index "${indexName}" configured`);
    } catch (error: any) {
      logger.warn(`Failed to configure index "${indexName}": ${error.message}`);
    }
  }
}

export default fp(meilisearchPlugin, {
  name: 'meilisearch',
});

export { meilisearchPlugin, INDEX_SETTINGS };
