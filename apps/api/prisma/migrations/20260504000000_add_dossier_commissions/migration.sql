-- CreateTable
CREATE TABLE "dossier_commissions" (
    "id" TEXT NOT NULL,
    "dossier_id" TEXT NOT NULL,
    "commission_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dossier_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dossier_commissions_commission_id_idx" ON "dossier_commissions"("commission_id");

-- CreateIndex
CREATE INDEX "dossier_commissions_dossier_id_idx" ON "dossier_commissions"("dossier_id");

-- CreateIndex
CREATE UNIQUE INDEX "dossier_commissions_dossier_id_commission_id_role_key" ON "dossier_commissions"("dossier_id", "commission_id", "role");

-- AddForeignKey
ALTER TABLE "dossier_commissions" ADD CONSTRAINT "dossier_commissions_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers_legislatifs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_commissions" ADD CONSTRAINT "dossier_commissions_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "commissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
