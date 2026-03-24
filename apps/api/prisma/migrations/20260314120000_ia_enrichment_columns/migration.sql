-- AlterTable: Add IA enrichment columns to scrutins
ALTER TABLE "scrutins" ADD COLUMN "resume_ia" TEXT;
ALTER TABLE "scrutins" ADD COLUMN "ia_content_hash" TEXT;
ALTER TABLE "scrutins" ADD COLUMN "ia_generated_at" TIMESTAMPTZ;

-- AlterTable: Add IA enrichment columns to dossiers_legislatifs
ALTER TABLE "dossiers_legislatifs" ADD COLUMN "resume_ia" TEXT;
ALTER TABLE "dossiers_legislatifs" ADD COLUMN "ia_content_hash" TEXT;
ALTER TABLE "dossiers_legislatifs" ADD COLUMN "ia_generated_at" TIMESTAMPTZ;

-- AlterTable: Add IA enrichment columns to sujets
ALTER TABLE "sujets" ADD COLUMN "ia_content_hash" TEXT;
ALTER TABLE "sujets" ADD COLUMN "ia_generated_at" TIMESTAMPTZ;
