// =============================================================================
// Service d'indexation Meilisearch
// =============================================================================

import { FastifyInstance } from 'fastify';
import { logger } from '../../utils/logger';
import type { DeputeDocument, ScrutinDocument, LobbyisteDocument } from '../../plugins/meilisearch';

const BATCH_SIZE = 500;

export async function indexAllDeputes(fastify: FastifyInstance): Promise<number> {
  // Index tous les parlementaires (députés et sénateurs) dans l'index "deputes" pour compatibilité
  const parlementaires = await fastify.prisma.parlementaire.findMany({
    include: {
      groupe: true,
      circonscription: true,
    },
  });

  const documents: DeputeDocument[] = parlementaires.map((d) => {
    // Le champ nom peut contenir soit juste le nom de famille, soit le nom complet
    const nomComplet = d.nom.includes(d.prenom) ? d.nom : `${d.prenom} ${d.nom}`;
    return {
      id: d.id,
      slug: d.slug,
      chambre: d.chambre, // 'assemblee' ou 'senat'
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

  // Indexer par batches
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    await fastify.meiliIndexes.deputes.addDocuments(batch);
    logger.info(`Indexed deputes batch ${i / BATCH_SIZE + 1}/${Math.ceil(documents.length / BATCH_SIZE)}`);
  }

  return documents.length;
}

export async function indexAllScrutins(fastify: FastifyInstance): Promise<number> {
  const scrutins = await fastify.prisma.scrutin.findMany({
    orderBy: { date: 'desc' },
  });

  const documents: ScrutinDocument[] = scrutins.map((s) => ({
    id: s.id,
    numero: s.numero,
    chambre: s.chambre, // 'assemblee' ou 'senat'
    date: s.date.toISOString(),
    titre: s.titre,
    sort: s.sort,
    typeVote: s.typeVote,
    importance: s.importance,
    tags: s.tags,
    nombrePour: s.nombrePour,
    nombreContre: s.nombreContre,
  }));

  // Indexer par batches
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    await fastify.meiliIndexes.scrutins.addDocuments(batch);
    logger.info(`Indexed scrutins batch ${i / BATCH_SIZE + 1}/${Math.ceil(documents.length / BATCH_SIZE)}`);
  }

  return documents.length;
}

export async function indexAllLobbyistes(fastify: FastifyInstance): Promise<number> {
  const lobbyistes = await fastify.prisma.lobbyiste.findMany();

  const documents: LobbyisteDocument[] = lobbyistes.map((l) => ({
    id: l.id,
    nom: l.nom,
    type: l.type,
    secteur: l.secteur,
    budgetAnnuel: l.budgetAnnuel,
    nbLobbyistes: l.nbLobbyistes,
    ville: l.ville,
  }));

  // Indexer par batches
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    await fastify.meiliIndexes.lobbyistes.addDocuments(batch);
    logger.info(`Indexed lobbyistes batch ${i / BATCH_SIZE + 1}/${Math.ceil(documents.length / BATCH_SIZE)}`);
  }

  return documents.length;
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
