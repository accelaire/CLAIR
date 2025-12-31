// =============================================================================
// Module Ingestion Candidats
// Gestion automatique du scoring et de l'ingestion des données candidats
// =============================================================================

export { candidatsAdminRoutes } from './admin.controller';
export {
  calculateScoresFromVotes,
  calculateCoherence,
  updateCandidatScores,
  recalculateAllCandidats,
} from './scoring.service';
