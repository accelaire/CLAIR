-- =============================================================================
-- Multi-législatures — Phase 4 : stats de carrière
-- Voir SPEC-MULTI-LEGISLATURES.md (ticket #13).
-- =============================================================================
--
-- Les classements doivent pouvoir trier sur DEUX périodes :
--   - le mandat en cours (défaut) : seule façon de comparer des élus entre eux,
--     puisqu'ils partagent alors le même dénominateur de scrutins ;
--   - la carrière (tous mandats cumulés) : répond à une autre question, « qui a
--     le plus siégé, tout compris ».
--
-- Trier via Prisma exige une colonne scalaire → deux jeux de colonnes.
-- `parlementaires.stats_*` porte le mandat en cours ; ces colonnes la carrière.
-- Le détail par mandat vit dans `mandats_parlementaires.stats_*`.
--
-- SÛRETÉ : 100% additif (colonnes nullables, aucune contrainte touchée). Les
-- valeurs sont remplies par le batch `calculate-stats` au prochain run.
-- =============================================================================

ALTER TABLE "parlementaires" ADD COLUMN "stats_carriere_presence" INTEGER;
ALTER TABLE "parlementaires" ADD COLUMN "stats_carriere_loyaute" INTEGER;
ALTER TABLE "parlementaires" ADD COLUMN "stats_carriere_participation" INTEGER;
ALTER TABLE "parlementaires" ADD COLUMN "stats_carriere_interventions" INTEGER;
ALTER TABLE "parlementaires" ADD COLUMN "stats_carriere_amendements" INTEGER;
