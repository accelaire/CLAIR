-- Drop Simulateur 2027 tables (cascade order: children first)
DROP TABLE IF EXISTS "simulation_resultats" CASCADE;
DROP TABLE IF EXISTS "simulations_vie" CASCADE;
DROP TABLE IF EXISTS "reponses_simulateur" CASCADE;
DROP TABLE IF EXISTS "sessions_simulateur" CASCADE;
DROP TABLE IF EXISTS "stats_simulateur" CASCADE;
DROP TABLE IF EXISTS "positions_candidats" CASCADE;
DROP TABLE IF EXISTS "questions_simulateur" CASCADE;
DROP TABLE IF EXISTS "ingestion_logs" CASCADE;
DROP TABLE IF EXISTS "validation_queue" CASCADE;
DROP TABLE IF EXISTS "candidats_2027" CASCADE;

-- Drop Auth tables (cascade order: children first)
DROP TABLE IF EXISTS "refresh_tokens" CASCADE;
DROP TABLE IF EXISTS "alertes" CASCADE;
DROP TABLE IF EXISTS "favoris" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
