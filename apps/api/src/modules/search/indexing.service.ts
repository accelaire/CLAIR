// =============================================================================
// Service d'indexation Meilisearch
// =============================================================================

import { FastifyInstance } from 'fastify';
import { logger } from '../../utils/logger';
import type { DeputeDocument, ScrutinDocument, LobbyisteDocument } from '../../plugins/meilisearch';

const BATCH_SIZE = 500;
const DB_BATCH_SIZE = 1000; // Batch size for database fetching to prevent OOM

export async function indexAllDeputes(fastify: FastifyInstance): Promise<number> {
  // Use offset pagination to prevent loading all records into memory
  let totalIndexed = 0;
  let skip = 0;

  while (true) {
    const parlementaires = await fastify.prisma.parlementaire.findMany({
      take: DB_BATCH_SIZE,
      skip,
      orderBy: { id: 'asc' },
      include: {
        groupe: true,
        circonscription: true,
      },
    });

    if (parlementaires.length === 0) break;

    const documents: DeputeDocument[] = parlementaires.map((d) => {
      const nomComplet = d.nom.includes(d.prenom) ? d.nom : `${d.prenom} ${d.nom}`;
      return {
        id: d.id,
        slug: d.slug,
        chambre: d.chambre,
        nom: d.nom,
        prenom: d.prenom,
        nomComplet,
        photoUrl: d.photoUrl,
        groupe: d.groupe?.nom || null,
        groupeCouleur: d.groupe?.couleur || null,
        circonscription: d.circonscription?.nom || null,
        departement: d.circonscription?.departement || null,
        profession: d.profession,
        actif: d.actif,
      };
    });

    // Index in smaller batches for Meilisearch
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      await fastify.meiliIndexes.deputes.addDocuments(batch);
    }

    totalIndexed += documents.length;
    skip += parlementaires.length;
    logger.info(`Indexed ${totalIndexed} deputes so far...`);

    if (parlementaires.length < DB_BATCH_SIZE) break;
  }

  logger.info(`Finished indexing ${totalIndexed} deputes`);
  return totalIndexed;
}

export async function indexAllScrutins(fastify: FastifyInstance): Promise<number> {
  // Use offset pagination to prevent loading all records into memory
  let totalIndexed = 0;
  let skip = 0;

  while (true) {
    const scrutins = await fastify.prisma.scrutin.findMany({
      take: DB_BATCH_SIZE,
      skip,
      orderBy: { id: 'asc' },
    });

    if (scrutins.length === 0) break;

    const documents: ScrutinDocument[] = scrutins.map((s) => ({
      id: s.id,
      numero: s.numero,
      chambre: s.chambre,
      date: s.date.toISOString(),
      titre: s.titre,
      sort: s.sort,
      typeVote: s.typeVote,
      importance: s.importance,
      tags: s.tags,
      nombrePour: s.nombrePour,
      nombreContre: s.nombreContre,
    }));

    // Index in smaller batches for Meilisearch
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      await fastify.meiliIndexes.scrutins.addDocuments(batch);
    }

    totalIndexed += documents.length;
    skip += scrutins.length;
    logger.info(`Indexed ${totalIndexed} scrutins so far...`);

    if (scrutins.length < DB_BATCH_SIZE) break;
  }

  logger.info(`Finished indexing ${totalIndexed} scrutins`);
  return totalIndexed;
}

export async function indexAllLobbyistes(fastify: FastifyInstance): Promise<number> {
  // Use offset pagination to prevent loading all records into memory
  let totalIndexed = 0;
  let skip = 0;

  while (true) {
    const lobbyistes = await fastify.prisma.lobbyiste.findMany({
      take: DB_BATCH_SIZE,
      skip,
      orderBy: { id: 'asc' },
    });

    if (lobbyistes.length === 0) break;

    const documents: LobbyisteDocument[] = lobbyistes.map((l) => ({
      id: l.id,
      nom: l.nom,
      type: l.type,
      secteur: l.secteur,
      budgetAnnuel: l.budgetAnnuel,
      nbLobbyistes: l.nbLobbyistes,
      ville: l.ville,
    }));

    // Index in smaller batches for Meilisearch
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      await fastify.meiliIndexes.lobbyistes.addDocuments(batch);
    }

    totalIndexed += documents.length;
    skip += lobbyistes.length;
    logger.info(`Indexed ${totalIndexed} lobbyistes so far...`);

    if (lobbyistes.length < DB_BATCH_SIZE) break;
  }

  logger.info(`Finished indexing ${totalIndexed} lobbyistes`);
  return totalIndexed;
}

export async function indexAll(fastify: FastifyInstance): Promise<{
  deputes: number;
  scrutins: number;
  lobbyistes: number;
}> {
  logger.info('Starting full Meilisearch indexation...');

  const [deputes, scrutins, lobbyistes] = await Promise.all([
    indexAllDeputes(fastify),
    indexAllScrutins(fastify),
    indexAllLobbyistes(fastify),
  ]);

  logger.info(`Indexation complete: ${deputes} deputes, ${scrutins} scrutins, ${lobbyistes} lobbyistes`);

  return { deputes, scrutins, lobbyistes };
}

export async function clearAllIndexes(fastify: FastifyInstance): Promise<void> {
  await Promise.all([
    fastify.meiliIndexes.deputes.deleteAllDocuments(),
    fastify.meiliIndexes.scrutins.deleteAllDocuments(),
    fastify.meiliIndexes.lobbyistes.deleteAllDocuments(),
  ]);
  logger.info('All Meilisearch indexes cleared');
}
