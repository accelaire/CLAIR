-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "organe_ref" TEXT,
    "slug" TEXT NOT NULL,
    "chambre" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "nom_court" TEXT,
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3),
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reunions" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3),
    "lieu" TEXT,
    "etat" TEXT NOT NULL,
    "odj_resume" TEXT,
    "odj_complet" TEXT,
    "captation_video" BOOLEAN NOT NULL DEFAULT false,
    "ouverte_presse" BOOLEAN NOT NULL DEFAULT false,
    "compte_rendu_ref" TEXT,
    "url_video" TEXT,
    "commission_id" TEXT,
    "organe_ref" TEXT,

    CONSTRAINT "reunions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reunion_participants" (
    "id" TEXT NOT NULL,
    "reunion_id" TEXT NOT NULL,
    "parlementaire_id" TEXT NOT NULL,
    "presence" TEXT NOT NULL,

    CONSTRAINT "reunion_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commissions_uid_key" ON "commissions"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_slug_key" ON "commissions"("slug");

-- CreateIndex
CREATE INDEX "commissions_chambre_idx" ON "commissions"("chambre");

-- CreateIndex
CREATE INDEX "commissions_type_idx" ON "commissions"("type");

-- CreateIndex
CREATE INDEX "commissions_actif_idx" ON "commissions"("actif");

-- CreateIndex
CREATE INDEX "commissions_organe_ref_idx" ON "commissions"("organe_ref");

-- CreateIndex
CREATE UNIQUE INDEX "reunions_uid_key" ON "reunions"("uid");

-- CreateIndex
CREATE INDEX "reunions_date_debut_idx" ON "reunions"("date_debut");

-- CreateIndex
CREATE INDEX "reunions_commission_id_idx" ON "reunions"("commission_id");

-- CreateIndex
CREATE INDEX "reunions_type_idx" ON "reunions"("type");

-- CreateIndex
CREATE INDEX "reunions_etat_idx" ON "reunions"("etat");

-- CreateIndex
CREATE INDEX "reunions_organe_ref_idx" ON "reunions"("organe_ref");

-- CreateIndex
CREATE UNIQUE INDEX "reunion_participants_reunion_id_parlementaire_id_key" ON "reunion_participants"("reunion_id", "parlementaire_id");

-- CreateIndex
CREATE INDEX "reunion_participants_parlementaire_id_idx" ON "reunion_participants"("parlementaire_id");

-- AlterTable mandats: add commission relation + organe_ref
ALTER TABLE "mandats" ADD COLUMN "commission_id" TEXT;
ALTER TABLE "mandats" ADD COLUMN "organe_ref" TEXT;

-- CreateIndex
CREATE INDEX "mandats_commission_id_idx" ON "mandats"("commission_id");
CREATE UNIQUE INDEX "mandats_parlementaire_id_organe_ref_key" ON "mandats"("parlementaire_id", "organe_ref");

-- AddForeignKey
ALTER TABLE "reunions" ADD CONSTRAINT "reunions_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "commissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reunion_participants" ADD CONSTRAINT "reunion_participants_reunion_id_fkey" FOREIGN KEY ("reunion_id") REFERENCES "reunions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reunion_participants" ADD CONSTRAINT "reunion_participants_parlementaire_id_fkey" FOREIGN KEY ("parlementaire_id") REFERENCES "parlementaires"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mandats" ADD CONSTRAINT "mandats_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "commissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
