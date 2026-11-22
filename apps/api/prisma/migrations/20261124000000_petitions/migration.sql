-- Pétitions citoyennes de l'Assemblée nationale et du Sénat (#84) : les
-- pétitions des jeux data.gouv.fr, le parcours de chacune (étapes datées et
-- sourcées : agenda des commissions, dossiers de la procédure « Pétitions »,
-- page officielle) et les relevés de son compteur de signatures.
--
-- Trois créations de table : le code déployé les ignore, la migration peut
-- passer en production avant la fusion. Les tables restent vides jusqu'à la
-- première nuit (ou la commande `sync-petitions`).
--
-- Les triggers d'horodatage sont la copie de `prisma/triggers.sql` à la date
-- de la migration.

SET lock_timeout = '5s';

-- CreateTable
CREATE TABLE "petitions" (
    "id" TEXT NOT NULL,
    "chambre" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "extrait" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "texte_incomplet" BOOLEAN NOT NULL DEFAULT false,
    "date_publication" DATE NOT NULL,
    "date_limite" DATE,
    "signatures" INTEGER,
    "statut_source" TEXT NOT NULL,
    "collecte" TEXT NOT NULL,
    "legislature" INTEGER,
    "type_source" TEXT,
    "commission_source" TEXT,
    "commission_id" TEXT,
    "decision_source" TEXT,
    "decision_page" TEXT,
    "decision_page_date" DATE,
    "page_lue_le" TIMESTAMP(3),
    "etape" TEXT,
    "etape_date" DATE,
    "suivie" BOOLEAN NOT NULL DEFAULT false,
    "url" TEXT NOT NULL,
    "empreinte_source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "petitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "petitions_etapes" (
    "id" TEXT NOT NULL,
    "petition_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATE,
    "source" TEXT NOT NULL,
    "rattachement" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "reunion_id" TEXT,
    "dossier_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "petitions_etapes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "petitions_releves" (
    "petition_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "signatures" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "petitions_releves_pkey" PRIMARY KEY ("petition_id","date")
);

-- CreateIndex
CREATE INDEX "petitions_commission_id_idx" ON "petitions"("commission_id");

-- CreateIndex
CREATE INDEX "petitions_suivie_signatures_idx" ON "petitions"("suivie", "signatures");

-- CreateIndex
CREATE INDEX "petitions_signatures_idx" ON "petitions"("signatures");

-- CreateIndex
CREATE INDEX "petitions_date_publication_idx" ON "petitions"("date_publication");

-- CreateIndex
CREATE INDEX "petitions_etape_idx" ON "petitions"("etape");

-- CreateIndex
CREATE UNIQUE INDEX "petitions_chambre_numero_key" ON "petitions"("chambre", "numero");

-- CreateIndex
CREATE INDEX "petitions_etapes_dossier_id_idx" ON "petitions_etapes"("dossier_id");

-- CreateIndex
CREATE INDEX "petitions_etapes_reunion_id_idx" ON "petitions_etapes"("reunion_id");

-- CreateIndex
CREATE UNIQUE INDEX "petitions_etapes_petition_id_type_source_cle_key" ON "petitions_etapes"("petition_id", "type", "source", "cle");

-- AddForeignKey
ALTER TABLE "petitions" ADD CONSTRAINT "petitions_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "commissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petitions_etapes" ADD CONSTRAINT "petitions_etapes_petition_id_fkey" FOREIGN KEY ("petition_id") REFERENCES "petitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petitions_etapes" ADD CONSTRAINT "petitions_etapes_reunion_id_fkey" FOREIGN KEY ("reunion_id") REFERENCES "reunions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petitions_etapes" ADD CONSTRAINT "petitions_etapes_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers_legislatifs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petitions_releves" ADD CONSTRAINT "petitions_releves_petition_id_fkey" FOREIGN KEY ("petition_id") REFERENCES "petitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Horodatage. La dernière lecture de la page officielle et l'empreinte de la
-- ligne source décrivent notre traitement, pas la pétition.
CREATE OR REPLACE TRIGGER petitions_updated_at BEFORE INSERT OR UPDATE ON petitions
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at('page_lue_le', 'empreinte_source');
CREATE OR REPLACE TRIGGER petitions_etapes_updated_at BEFORE INSERT OR UPDATE ON petitions_etapes
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER petitions_releves_updated_at BEFORE INSERT OR UPDATE ON petitions_releves
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
