-- Gouvernements, postes ministériels et présidences de la République
-- (ticket #103, G1), lus dans l'archive AMO30 de l'AN : voir
-- SPEC-GOUVERNEMENT.md. Présidences de l'Assemblée, datées par l'AMO30 (celles
-- du Sénat sont des mandats du bureau, écrits par senat-fonctions).
--
-- Uniquement des créations : le code déjà déployé ignore ces tables, la
-- migration peut donc passer en production avant la fusion. Les clés
-- étrangères vers `parlementaires` y prennent un verrou bref qui bloque les
-- écritures (pas les lectures) : à jouer hors du batch nocturne.
--
-- Les triggers d'horodatage sont la copie de `prisma/triggers.sql` à la date de
-- la migration ; ils viennent après les tables, qu'ils supposent.

SET lock_timeout = '5s';

-- CreateTable
CREATE TABLE "gouvernements" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "libelle_source" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gouvernements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membres_gouvernement" (
    "id" TEXT NOT NULL,
    "acteur_uid" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "civilite" TEXT,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "date_naissance" DATE,
    "parlementaire_id" TEXT,
    "liaison" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membres_gouvernement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postes_ministeriels" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "gouvernement_id" TEXT NOT NULL,
    "membre_id" TEXT NOT NULL,
    "organe_uid" TEXT NOT NULL,
    "qualite" TEXT NOT NULL,
    "qualite_accordee" TEXT,
    "rang_protocolaire" INTEGER NOT NULL,
    "intitule" TEXT NOT NULL,
    "intitule_court" TEXT,
    "intitule_complement" TEXT,
    "domaine" TEXT,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE,
    "date_publication" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "postes_ministeriels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presidences" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "civilite" TEXT,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE,
    "acteur_uid" TEXT,
    "parlementaire_id" TEXT,
    "liaison" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presidences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gouvernements_uid_key" ON "gouvernements"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "gouvernements_slug_key" ON "gouvernements"("slug");

-- CreateIndex
CREATE INDEX "gouvernements_date_debut_idx" ON "gouvernements"("date_debut");

-- CreateIndex
CREATE UNIQUE INDEX "membres_gouvernement_acteur_uid_key" ON "membres_gouvernement"("acteur_uid");

-- CreateIndex
CREATE UNIQUE INDEX "membres_gouvernement_slug_key" ON "membres_gouvernement"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "membres_gouvernement_parlementaire_id_key" ON "membres_gouvernement"("parlementaire_id");

-- CreateIndex
CREATE UNIQUE INDEX "postes_ministeriels_uid_key" ON "postes_ministeriels"("uid");

-- CreateIndex
CREATE INDEX "postes_ministeriels_gouvernement_id_rang_protocolaire_idx" ON "postes_ministeriels"("gouvernement_id", "rang_protocolaire");

-- CreateIndex
CREATE INDEX "postes_ministeriels_membre_id_idx" ON "postes_ministeriels"("membre_id");

-- CreateIndex
CREATE UNIQUE INDEX "presidences_uid_key" ON "presidences"("uid");

-- CreateIndex
CREATE INDEX "presidences_date_debut_idx" ON "presidences"("date_debut");

-- CreateIndex
CREATE INDEX "presidences_parlementaire_id_idx" ON "presidences"("parlementaire_id");

-- AddForeignKey
ALTER TABLE "membres_gouvernement" ADD CONSTRAINT "membres_gouvernement_parlementaire_id_fkey" FOREIGN KEY ("parlementaire_id") REFERENCES "parlementaires"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postes_ministeriels" ADD CONSTRAINT "postes_ministeriels_gouvernement_id_fkey" FOREIGN KEY ("gouvernement_id") REFERENCES "gouvernements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postes_ministeriels" ADD CONSTRAINT "postes_ministeriels_membre_id_fkey" FOREIGN KEY ("membre_id") REFERENCES "membres_gouvernement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presidences" ADD CONSTRAINT "presidences_parlementaire_id_fkey" FOREIGN KEY ("parlementaire_id") REFERENCES "parlementaires"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "presidences_assemblee" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "acteur_uid" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE,
    "parlementaire_id" TEXT,
    "liaison" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presidences_assemblee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "presidences_assemblee_uid_key" ON "presidences_assemblee"("uid");

-- CreateIndex
CREATE INDEX "presidences_assemblee_date_debut_idx" ON "presidences_assemblee"("date_debut");

-- CreateIndex
CREATE INDEX "presidences_assemblee_parlementaire_id_idx" ON "presidences_assemblee"("parlementaire_id");

-- AddForeignKey
ALTER TABLE "presidences_assemblee" ADD CONSTRAINT "presidences_assemblee_parlementaire_id_fkey" FOREIGN KEY ("parlementaire_id") REFERENCES "parlementaires"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Horodatage des lignes
CREATE OR REPLACE TRIGGER gouvernements_updated_at BEFORE INSERT OR UPDATE ON gouvernements
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER membres_gouvernement_updated_at BEFORE INSERT OR UPDATE ON membres_gouvernement
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER postes_ministeriels_updated_at BEFORE INSERT OR UPDATE ON postes_ministeriels
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER presidences_updated_at BEFORE INSERT OR UPDATE ON presidences
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER presidences_assemblee_updated_at BEFORE INSERT OR UPDATE ON presidences_assemblee
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
