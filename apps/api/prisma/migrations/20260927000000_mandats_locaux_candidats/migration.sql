-- Mandats locaux des candidats aux sénatoriales, lus dans le Répertoire
-- national des élus.
--
-- Table additive, sans clé étrangère : `candidatures` est effacée et réécrite
-- par l'ingestion de chaque nuit, la jointure se fait sur l'identité du
-- candidat (nom, prénom, date de naissance).

-- CreateTable
CREATE TABLE "candidats_mandats_locaux" (
    "id" TEXT NOT NULL,
    "scrutin" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "date_naissance" DATE NOT NULL,
    "mandats" JSONB NOT NULL,
    "confiance" TEXT NOT NULL,
    "source_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidats_mandats_locaux_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidats_mandats_locaux_scrutin_nom_prenom_date_naissance_key" ON "candidats_mandats_locaux"("scrutin", "nom", "prenom", "date_naissance");
