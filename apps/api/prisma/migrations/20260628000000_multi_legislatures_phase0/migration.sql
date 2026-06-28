-- =============================================================================
-- Multi-législatures (AN) / Multi-mandatures (Sénat) — Phase 0 (additif, DDL pur)
-- Voir SPEC-MULTI-LEGISLATURES.md (ticket #13).
--
-- Sépare l'identité (parlementaires = personne stable) du contexte de mandat via
-- la nouvelle table `mandats_parlementaires`, et ajoute la dimension `legislature`
-- aux groupes et scrutins.
--
-- SÛRETÉ : 100% additif (aucun DROP, aucune contrainte modifiée). L'unique de
-- `groupes_politiques` reste [slug, chambre] en Phase 0 (non-breaking pour l'API) ;
-- son passage à [slug, chambre, legislature] est reporté en Phase 1, quand
-- l'ingestion créera réellement des groupes multi-législatures.
--
-- Le backfill des données (legislature=17 sur l'AN + bootstrap des mandats) est
-- réalisé séparément par la commande idempotente `backfill-mandats` (ingestion CLI).
-- =============================================================================

-- AlterTable
ALTER TABLE "groupes_politiques" ADD COLUMN     "legislature" INTEGER;

-- AlterTable
ALTER TABLE "scrutins" ADD COLUMN     "legislature" INTEGER;

-- CreateTable
CREATE TABLE "mandats_parlementaires" (
    "id" TEXT NOT NULL,
    "personne_id" TEXT NOT NULL,
    "chambre" TEXT NOT NULL DEFAULT 'assemblee',
    "legislature" INTEGER,
    "mandature" INTEGER,
    "serie" TEXT,
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3),
    "groupe_id" TEXT,
    "circonscription_id" TEXT,
    "commission_permanente" TEXT,
    "stats_presence" INTEGER,
    "stats_presence_solennel" INTEGER,
    "stats_loyaute" INTEGER,
    "stats_participation" INTEGER,
    "stats_interventions" INTEGER,
    "stats_amendements" INTEGER,
    "stats_amendements_adoptes" INTEGER,
    "stats_questions" INTEGER,
    "stats_calculated_at" TIMESTAMP(3),
    "mandat_uid" TEXT,
    "source_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mandats_parlementaires_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mandats_parlementaires_mandat_uid_key" ON "mandats_parlementaires"("mandat_uid");

-- CreateIndex
CREATE INDEX "mandats_parlementaires_personne_id_idx" ON "mandats_parlementaires"("personne_id");

-- CreateIndex
CREATE INDEX "mandats_parlementaires_legislature_idx" ON "mandats_parlementaires"("legislature");

-- CreateIndex
CREATE INDEX "mandats_parlementaires_mandature_idx" ON "mandats_parlementaires"("mandature");

-- CreateIndex
CREATE INDEX "mandats_parlementaires_chambre_legislature_idx" ON "mandats_parlementaires"("chambre", "legislature");

-- CreateIndex
CREATE INDEX "mandats_parlementaires_groupe_id_idx" ON "mandats_parlementaires"("groupe_id");

-- CreateIndex
CREATE UNIQUE INDEX "mandats_parlementaires_personne_id_chambre_legislature_mand_key" ON "mandats_parlementaires"("personne_id", "chambre", "legislature", "mandature");

-- CreateIndex
CREATE INDEX "groupes_politiques_legislature_idx" ON "groupes_politiques"("legislature");

-- CreateIndex
CREATE INDEX "scrutins_legislature_idx" ON "scrutins"("legislature");

-- AddForeignKey
ALTER TABLE "mandats_parlementaires" ADD CONSTRAINT "mandats_parlementaires_personne_id_fkey" FOREIGN KEY ("personne_id") REFERENCES "parlementaires"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mandats_parlementaires" ADD CONSTRAINT "mandats_parlementaires_groupe_id_fkey" FOREIGN KEY ("groupe_id") REFERENCES "groupes_politiques"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mandats_parlementaires" ADD CONSTRAINT "mandats_parlementaires_circonscription_id_fkey" FOREIGN KEY ("circonscription_id") REFERENCES "circonscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
