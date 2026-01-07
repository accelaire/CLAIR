/*
  Warnings:

  - You are about to drop the column `objet` on the `amendements` table. All the data in the column will be lost.
  - You are about to drop the column `source_url` on the `amendements` table. All the data in the column will be lost.
  - You are about to drop the column `texte_id` on the `amendements` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[uid]` on the table `amendements` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `uid` to the `amendements` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "amendements" DROP CONSTRAINT "amendements_depute_id_fkey";

-- AlterTable
ALTER TABLE "amendements" DROP COLUMN "objet",
DROP COLUMN "source_url",
DROP COLUMN "texte_id",
ADD COLUMN     "auteur_libelle" TEXT,
ADD COLUMN     "auteur_ref" TEXT,
ADD COLUMN     "expose_sommaire" TEXT,
ADD COLUMN     "groupe_ref" TEXT,
ADD COLUMN     "legislature" INTEGER NOT NULL DEFAULT 17,
ADD COLUMN     "texte_ref" TEXT,
ADD COLUMN     "uid" TEXT NOT NULL,
ALTER COLUMN "depute_id" DROP NOT NULL,
ALTER COLUMN "sort" DROP NOT NULL,
ALTER COLUMN "date_depot" DROP NOT NULL;

-- CreateTable
CREATE TABLE "candidats_2027" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "parti" TEXT NOT NULL,
    "photo_url" TEXT,
    "depute_id" TEXT,
    "programme" JSONB NOT NULL DEFAULT '{}',
    "programme_url" TEXT,
    "programme_parsed_at" TIMESTAMP(3),
    "score_economie" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score_social" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score_ecologie" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score_securite" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score_europe" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score_immigration" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score_institutions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score_international" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score_type" TEXT NOT NULL DEFAULT 'estimated',
    "coherence_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ingestion_status" TEXT NOT NULL DEFAULT 'pending',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidats_2027_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions_simulateur" (
    "id" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "contexte" TEXT,
    "option_a" TEXT,
    "option_b" TEXT,
    "label_gauche" TEXT,
    "label_droite" TEXT,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "citation" TEXT,
    "citation_auteur" TEXT,
    "citation_score" DOUBLE PRECISION,
    "axes_poids" JSONB NOT NULL DEFAULT '{}',
    "scrutin_id" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_simulateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions_candidats" (
    "id" TEXT NOT NULL,
    "candidat_id" TEXT NOT NULL,
    "axe" TEXT NOT NULL,
    "sujet" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_url" TEXT,
    "source_date" TIMESTAMP(3),
    "coherent" BOOLEAN NOT NULL DEFAULT true,
    "explication" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "positions_candidats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions_simulateur" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "session_token" TEXT NOT NULL,
    "tranche_age" TEXT,
    "situation" TEXT,
    "localisation" TEXT,
    "habitat" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'en_cours',
    "completed_at" TIMESTAMP(3),
    "profil_politique" TEXT,
    "scores_axes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_simulateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reponses_simulateur" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "reponse" JSONB NOT NULL,
    "temps_reponse_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reponses_simulateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_resultats" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "candidat_id" TEXT NOT NULL,
    "match_score" DOUBLE PRECISION NOT NULL,
    "scores_detail" JSONB NOT NULL,
    "points_forts" TEXT[],
    "divergences" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulation_resultats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulations_vie" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "candidat_id" TEXT NOT NULL,
    "profil_utilisateur" JSONB NOT NULL,
    "impact_pouvoir_achat" JSONB NOT NULL,
    "impact_sante" JSONB NOT NULL,
    "impact_environnement" JSONB NOT NULL,
    "impact_carriere" JSONB NOT NULL,
    "impact_logement" JSONB NOT NULL,
    "sources" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulations_vie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stats_simulateur" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "total_sessions" INTEGER NOT NULL,
    "sessions_completes" INTEGER NOT NULL,
    "repartition_profils" JSONB NOT NULL,
    "par_age" JSONB NOT NULL,
    "par_region" JSONB NOT NULL,
    "par_situation" JSONB NOT NULL,
    "scores_moyens" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stats_simulateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_logs" (
    "id" TEXT NOT NULL,
    "candidat_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "details" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "ingestion_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_queue" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "validated_by" TEXT,
    "validated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidats_2027_slug_key" ON "candidats_2027"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "candidats_2027_depute_id_key" ON "candidats_2027"("depute_id");

-- CreateIndex
CREATE INDEX "candidats_2027_parti_idx" ON "candidats_2027"("parti");

-- CreateIndex
CREATE INDEX "candidats_2027_actif_idx" ON "candidats_2027"("actif");

-- CreateIndex
CREATE UNIQUE INDEX "questions_simulateur_ordre_key" ON "questions_simulateur"("ordre");

-- CreateIndex
CREATE INDEX "positions_candidats_candidat_id_idx" ON "positions_candidats"("candidat_id");

-- CreateIndex
CREATE INDEX "positions_candidats_axe_idx" ON "positions_candidats"("axe");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_simulateur_session_token_key" ON "sessions_simulateur"("session_token");

-- CreateIndex
CREATE INDEX "sessions_simulateur_user_id_idx" ON "sessions_simulateur"("user_id");

-- CreateIndex
CREATE INDEX "sessions_simulateur_statut_idx" ON "sessions_simulateur"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "reponses_simulateur_session_id_question_id_key" ON "reponses_simulateur"("session_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "simulation_resultats_session_id_candidat_id_key" ON "simulation_resultats"("session_id", "candidat_id");

-- CreateIndex
CREATE UNIQUE INDEX "simulations_vie_session_id_candidat_id_key" ON "simulations_vie"("session_id", "candidat_id");

-- CreateIndex
CREATE UNIQUE INDEX "stats_simulateur_date_key" ON "stats_simulateur"("date");

-- CreateIndex
CREATE INDEX "ingestion_logs_candidat_id_idx" ON "ingestion_logs"("candidat_id");

-- CreateIndex
CREATE INDEX "ingestion_logs_type_idx" ON "ingestion_logs"("type");

-- CreateIndex
CREATE INDEX "ingestion_logs_started_at_idx" ON "ingestion_logs"("started_at");

-- CreateIndex
CREATE INDEX "validation_queue_type_idx" ON "validation_queue"("type");

-- CreateIndex
CREATE INDEX "validation_queue_status_idx" ON "validation_queue"("status");

-- CreateIndex
CREATE INDEX "validation_queue_priority_idx" ON "validation_queue"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "amendements_uid_key" ON "amendements"("uid");

-- CreateIndex
CREATE INDEX "amendements_legislature_idx" ON "amendements"("legislature");

-- CreateIndex
CREATE INDEX "amendements_auteur_ref_idx" ON "amendements"("auteur_ref");

-- AddForeignKey
ALTER TABLE "amendements" ADD CONSTRAINT "amendements_depute_id_fkey" FOREIGN KEY ("depute_id") REFERENCES "deputes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidats_2027" ADD CONSTRAINT "candidats_2027_depute_id_fkey" FOREIGN KEY ("depute_id") REFERENCES "deputes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions_candidats" ADD CONSTRAINT "positions_candidats_candidat_id_fkey" FOREIGN KEY ("candidat_id") REFERENCES "candidats_2027"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions_simulateur" ADD CONSTRAINT "sessions_simulateur_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reponses_simulateur" ADD CONSTRAINT "reponses_simulateur_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions_simulateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reponses_simulateur" ADD CONSTRAINT "reponses_simulateur_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions_simulateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_resultats" ADD CONSTRAINT "simulation_resultats_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions_simulateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_resultats" ADD CONSTRAINT "simulation_resultats_candidat_id_fkey" FOREIGN KEY ("candidat_id") REFERENCES "candidats_2027"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulations_vie" ADD CONSTRAINT "simulations_vie_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions_simulateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulations_vie" ADD CONSTRAINT "simulations_vie_candidat_id_fkey" FOREIGN KEY ("candidat_id") REFERENCES "candidats_2027"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_logs" ADD CONSTRAINT "ingestion_logs_candidat_id_fkey" FOREIGN KEY ("candidat_id") REFERENCES "candidats_2027"("id") ON DELETE CASCADE ON UPDATE CASCADE;
