-- Résultats des sénatoriales, lus le soir du scrutin sur le site de résultats
-- du ministère de l'Intérieur.
--
-- Deux tables additives, sans toucher à l'existant. `resultats_listes` pointe
-- vers l'unité de vote par son identifiant source et non par une clé
-- étrangère : l'ingestion des candidatures remplace le scrutin en entier et
-- fait tourner les identifiants, une clé étrangère ferait effacer les
-- résultats par le batch de la nuit suivante.

-- CreateTable
CREATE TABLE "resultats_tours" (
    "id" TEXT NOT NULL,
    "scrutin" TEXT NOT NULL,
    "circonscription_id" TEXT NOT NULL,
    "tour" INTEGER NOT NULL,
    "inscrits" INTEGER NOT NULL,
    "votants" INTEGER NOT NULL,
    "abstentions" INTEGER NOT NULL,
    "blancs" INTEGER NOT NULL,
    "nuls" INTEGER NOT NULL,
    "exprimes" INTEGER NOT NULL,
    "source_url" TEXT NOT NULL,
    "publie_a" TIMESTAMP(3) NOT NULL,
    "verifie_a" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resultats_tours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultats_listes" (
    "id" TEXT NOT NULL,
    "scrutin" TEXT NOT NULL,
    "circonscription_id" TEXT NOT NULL,
    "tour" INTEGER NOT NULL,
    "liste_source_uid" TEXT NOT NULL,
    "voix" INTEGER NOT NULL,
    "pct_inscrits" DOUBLE PRECISION,
    "pct_exprimes" DOUBLE PRECISION,
    "sieges" INTEGER,
    "elu" BOOLEAN,
    "libelle_source" TEXT NOT NULL,
    "nuance_source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resultats_listes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resultats_tours_scrutin_circonscription_id_tour_key" ON "resultats_tours"("scrutin", "circonscription_id", "tour");

-- CreateIndex
CREATE INDEX "resultats_listes_scrutin_circonscription_id_idx" ON "resultats_listes"("scrutin", "circonscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "resultats_listes_scrutin_liste_source_uid_tour_key" ON "resultats_listes"("scrutin", "liste_source_uid", "tour");

-- AddForeignKey
ALTER TABLE "resultats_tours" ADD CONSTRAINT "resultats_tours_circonscription_id_fkey" FOREIGN KEY ("circonscription_id") REFERENCES "circonscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultats_listes" ADD CONSTRAINT "resultats_listes_circonscription_id_fkey" FOREIGN KEY ("circonscription_id") REFERENCES "circonscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

