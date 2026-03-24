-- Add IA enrichment fields to parlementaires
ALTER TABLE "parlementaires" ADD COLUMN "resume_ia" TEXT;
ALTER TABLE "parlementaires" ADD COLUMN "parcours_ia" TEXT;
ALTER TABLE "parlementaires" ADD COLUMN "positions_cles_ia" TEXT;
ALTER TABLE "parlementaires" ADD COLUMN "faits_notables_ia" TEXT;
ALTER TABLE "parlementaires" ADD COLUMN "ia_content_hash" TEXT;
ALTER TABLE "parlementaires" ADD COLUMN "ia_generated_at" TIMESTAMP(3);

-- Create mandats table
CREATE TABLE "mandats" (
    "id" TEXT NOT NULL,
    "parlementaire_id" TEXT NOT NULL,
    "type_organe" TEXT NOT NULL,
    "institution" TEXT,
    "qualite" TEXT,
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3),
    "source_uid" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mandats_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "mandats_source_uid_key" ON "mandats"("source_uid");
CREATE INDEX "mandats_parlementaire_id_idx" ON "mandats"("parlementaire_id");
CREATE INDEX "mandats_type_organe_idx" ON "mandats"("type_organe");
CREATE INDEX "mandats_date_debut_idx" ON "mandats"("date_debut");

-- Foreign key
ALTER TABLE "mandats" ADD CONSTRAINT "mandats_parlementaire_id_fkey"
    FOREIGN KEY ("parlementaire_id") REFERENCES "parlementaires"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create declarations_hatvp table
CREATE TABLE "declarations_hatvp" (
    "id" TEXT NOT NULL,
    "parlementaire_id" TEXT NOT NULL,
    "type_document" TEXT NOT NULL,
    "date_publication" TIMESTAMP(3),
    "date_depot" TIMESTAMP(3),
    "url_dossier" TEXT,
    "nom_fichier" TEXT,
    "xml_fichier" TEXT,
    "statut" TEXT,
    "departement" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "declarations_hatvp_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "declarations_hatvp_parl_type_date_key"
    ON "declarations_hatvp"("parlementaire_id", "type_document", "date_depot");
CREATE INDEX "declarations_hatvp_parlementaire_id_idx" ON "declarations_hatvp"("parlementaire_id");
CREATE INDEX "declarations_hatvp_type_document_idx" ON "declarations_hatvp"("type_document");

-- Foreign key
ALTER TABLE "declarations_hatvp" ADD CONSTRAINT "declarations_hatvp_parlementaire_id_fkey"
    FOREIGN KEY ("parlementaire_id") REFERENCES "parlementaires"("id") ON DELETE CASCADE ON UPDATE CASCADE;
