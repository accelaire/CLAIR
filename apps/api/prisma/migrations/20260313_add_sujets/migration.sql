-- CreateTable
CREATE TABLE "sujets" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "dossier_count" INTEGER NOT NULL DEFAULT 0,
    "scrutin_count" INTEGER NOT NULL DEFAULT 0,
    "date_debut" TIMESTAMP(3),
    "date_fin" TIMESTAMP(3),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "featured_order" INTEGER NOT NULL DEFAULT 0,
    "match_method" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sujets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sujets_slug_key" ON "sujets"("slug");

-- CreateIndex
CREATE INDEX "sujets_actif_idx" ON "sujets"("actif");

-- CreateIndex
CREATE INDEX "sujets_category_idx" ON "sujets"("category");

-- CreateIndex
CREATE INDEX "sujets_featured_featured_order_idx" ON "sujets"("featured", "featured_order");

-- AlterTable
ALTER TABLE "dossiers_legislatifs" ADD COLUMN "sujet_id" TEXT;

-- CreateIndex
CREATE INDEX "dossiers_legislatifs_sujet_id_idx" ON "dossiers_legislatifs"("sujet_id");

-- AddForeignKey
ALTER TABLE "dossiers_legislatifs" ADD CONSTRAINT "dossiers_legislatifs_sujet_id_fkey" FOREIGN KEY ("sujet_id") REFERENCES "sujets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
