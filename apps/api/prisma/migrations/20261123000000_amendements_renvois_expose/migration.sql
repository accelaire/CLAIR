-- Renvois au droit en vigueur repérés dans l'exposé sommaire des amendements
-- (T5, ticket #46), à côté de ceux du dispositif. Une valeur par défaut
-- constante n'oblige pas Postgres à réécrire la table : l'ajout est immédiat.
-- Les lignes existantes gardent un tableau vide jusqu'à leur recalcul par la
-- version 2 de la détection (`sync-renvois-legi`).

-- AlterTable
ALTER TABLE "amendements_renvois" ADD COLUMN "renvois_expose" JSONB NOT NULL DEFAULT '[]';
