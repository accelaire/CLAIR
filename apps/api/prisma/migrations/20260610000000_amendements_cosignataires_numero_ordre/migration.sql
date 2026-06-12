-- CreateTable: implicit M:N join table for Amendement <-> Parlementaire cosignataires
CREATE TABLE "_AmendementCosignataires" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_AmendementCosignataires_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "_AmendementCosignataires_B_index" ON "_AmendementCosignataires"("B");

ALTER TABLE "_AmendementCosignataires" ADD CONSTRAINT "_AmendementCosignataires_A_fkey"
    FOREIGN KEY ("A") REFERENCES "amendements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_AmendementCosignataires" ADD CONSTRAINT "_AmendementCosignataires_B_fkey"
    FOREIGN KEY ("B") REFERENCES "parlementaires"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add numero_ordre for natural numeric sorting
ALTER TABLE "amendements" ADD COLUMN "numero_ordre" INTEGER;

-- Backfill numero_ordre from existing numero values
UPDATE "amendements" SET "numero_ordre" = CAST(
    NULLIF(REGEXP_REPLACE("numero", '[^0-9]', '', 'g'), '') AS INTEGER
);

-- CreateIndex
CREATE INDEX "idx_amendements_numero_ordre" ON "amendements"("numero_ordre");
