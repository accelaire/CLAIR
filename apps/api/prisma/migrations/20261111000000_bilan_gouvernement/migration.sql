-- Bilan des gouvernements et présidences des deux chambres (ticket #103, G1) :
-- voir SPEC-BILAN-MINISTRE.md.
--
-- - `presidences_chambre` : présidences de l'Assemblée (AMO30) et du Sénat
--   (export_sens), une table pour les deux chambres. Elle remplace
--   `presidences_assemblee`, qui n'est PAS supprimée ici : le code déployé la lit
--   jusqu'à la fusion. Une seconde migration la supprimera après la fusion et
--   une nuit vérifiée (déploiement en deux temps, §11).
-- - `projets_loi`, `projets_loi_signataires`, `engagements_responsabilite`,
--   `motions_censure`, `reponses_gouvernement` : le bilan, recalculé chaque nuit.
-- - Bureau d'âge : l'AMO10 a publié celui du 18/07/2024 (Jean-Pierre Gonzalez,
--   président d'âge, et quatre secrétaires d'âge) sans date de fin ; il ne
--   siège que jusqu'à l'élection du président, le jour même. Les 5 lignes sont
--   closes à leur date de début (UPDATE en fin de fichier) ; l'enrichissement
--   applique désormais la même règle (`dateFinMandatAN`).
--
-- Des créations, plus cette correction de 5 lignes : le code déjà déployé
-- ignore ces tables (et ne rouvre jamais une date de fin), la migration peut
-- donc passer en production avant la fusion. Les clés étrangères vers
-- `parlementaires`, `dossiers_legislatifs`, `scrutins` et `interventions` y
-- prennent un verrou bref qui bloque les écritures (pas les lectures) : à jouer
-- hors du batch nocturne.
--
-- Les triggers d'horodatage sont la copie de `prisma/triggers.sql` à la date de
-- la migration ; ils viennent après les tables, qu'ils supposent.

SET lock_timeout = '5s';

-- CreateTable
CREATE TABLE "presidences_chambre" (
    "id" TEXT NOT NULL,
    "chambre" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE,
    "parlementaire_id" TEXT,
    "liaison" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presidences_chambre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projets_loi" (
    "id" TEXT NOT NULL,
    "dossier_id" TEXT NOT NULL,
    "gouvernement_id" TEXT NOT NULL,
    "nature" TEXT NOT NULL,
    "chambre_depot" TEXT NOT NULL,
    "date_depot" DATE NOT NULL,
    "stade" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projets_loi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projets_loi_signataires" (
    "id" TEXT NOT NULL,
    "projet_id" TEXT NOT NULL,
    "poste_id" TEXT NOT NULL,
    "rang" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projets_loi_signataires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagements_responsabilite" (
    "id" TEXT NOT NULL,
    "dossier_id" TEXT NOT NULL,
    "poste_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dossier_texte_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engagements_responsabilite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motions_censure" (
    "id" TEXT NOT NULL,
    "scrutin_id" TEXT NOT NULL,
    "gouvernement_id" TEXT NOT NULL,
    "alinea" INTEGER NOT NULL,
    "engagement_id" TEXT,
    "premier_signataire" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "motions_censure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reponses_gouvernement" (
    "id" TEXT NOT NULL,
    "intervention_id" TEXT NOT NULL,
    "poste_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reponses_gouvernement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "presidences_chambre_uid_key" ON "presidences_chambre"("uid");

-- CreateIndex
CREATE INDEX "presidences_chambre_chambre_date_debut_idx" ON "presidences_chambre"("chambre", "date_debut");

-- CreateIndex
CREATE INDEX "presidences_chambre_parlementaire_id_idx" ON "presidences_chambre"("parlementaire_id");

-- CreateIndex
CREATE UNIQUE INDEX "projets_loi_dossier_id_key" ON "projets_loi"("dossier_id");

-- CreateIndex
CREATE INDEX "projets_loi_gouvernement_id_idx" ON "projets_loi"("gouvernement_id");

-- CreateIndex
CREATE INDEX "projets_loi_date_depot_idx" ON "projets_loi"("date_depot");

-- CreateIndex
CREATE INDEX "projets_loi_signataires_poste_id_idx" ON "projets_loi_signataires"("poste_id");

-- CreateIndex
CREATE UNIQUE INDEX "projets_loi_signataires_projet_id_poste_id_key" ON "projets_loi_signataires"("projet_id", "poste_id");

-- CreateIndex
CREATE UNIQUE INDEX "engagements_responsabilite_dossier_id_key" ON "engagements_responsabilite"("dossier_id");

-- CreateIndex
CREATE INDEX "engagements_responsabilite_poste_id_idx" ON "engagements_responsabilite"("poste_id");

-- CreateIndex
CREATE INDEX "engagements_responsabilite_dossier_texte_id_idx" ON "engagements_responsabilite"("dossier_texte_id");

-- CreateIndex
CREATE UNIQUE INDEX "motions_censure_scrutin_id_key" ON "motions_censure"("scrutin_id");

-- CreateIndex
CREATE INDEX "motions_censure_gouvernement_id_idx" ON "motions_censure"("gouvernement_id");

-- CreateIndex
CREATE INDEX "motions_censure_engagement_id_idx" ON "motions_censure"("engagement_id");

-- CreateIndex
CREATE UNIQUE INDEX "reponses_gouvernement_intervention_id_key" ON "reponses_gouvernement"("intervention_id");

-- CreateIndex
CREATE INDEX "reponses_gouvernement_poste_id_idx" ON "reponses_gouvernement"("poste_id");

-- AddForeignKey
ALTER TABLE "presidences_chambre" ADD CONSTRAINT "presidences_chambre_parlementaire_id_fkey" FOREIGN KEY ("parlementaire_id") REFERENCES "parlementaires"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projets_loi" ADD CONSTRAINT "projets_loi_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers_legislatifs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projets_loi" ADD CONSTRAINT "projets_loi_gouvernement_id_fkey" FOREIGN KEY ("gouvernement_id") REFERENCES "gouvernements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projets_loi_signataires" ADD CONSTRAINT "projets_loi_signataires_projet_id_fkey" FOREIGN KEY ("projet_id") REFERENCES "projets_loi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projets_loi_signataires" ADD CONSTRAINT "projets_loi_signataires_poste_id_fkey" FOREIGN KEY ("poste_id") REFERENCES "postes_ministeriels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagements_responsabilite" ADD CONSTRAINT "engagements_responsabilite_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers_legislatifs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagements_responsabilite" ADD CONSTRAINT "engagements_responsabilite_poste_id_fkey" FOREIGN KEY ("poste_id") REFERENCES "postes_ministeriels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagements_responsabilite" ADD CONSTRAINT "engagements_responsabilite_dossier_texte_id_fkey" FOREIGN KEY ("dossier_texte_id") REFERENCES "dossiers_legislatifs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motions_censure" ADD CONSTRAINT "motions_censure_scrutin_id_fkey" FOREIGN KEY ("scrutin_id") REFERENCES "scrutins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motions_censure" ADD CONSTRAINT "motions_censure_gouvernement_id_fkey" FOREIGN KEY ("gouvernement_id") REFERENCES "gouvernements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motions_censure" ADD CONSTRAINT "motions_censure_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "engagements_responsabilite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reponses_gouvernement" ADD CONSTRAINT "reponses_gouvernement_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "interventions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reponses_gouvernement" ADD CONSTRAINT "reponses_gouvernement_poste_id_fkey" FOREIGN KEY ("poste_id") REFERENCES "postes_ministeriels"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Horodatage (copie de prisma/triggers.sql)
CREATE OR REPLACE TRIGGER presidences_chambre_updated_at BEFORE INSERT OR UPDATE ON presidences_chambre
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER projets_loi_updated_at BEFORE INSERT OR UPDATE ON projets_loi
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER projets_loi_signataires_updated_at BEFORE INSERT OR UPDATE ON projets_loi_signataires
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER engagements_responsabilite_updated_at BEFORE INSERT OR UPDATE ON engagements_responsabilite
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER motions_censure_updated_at BEFORE INSERT OR UPDATE ON motions_censure
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER reponses_gouvernement_updated_at BEFORE INSERT OR UPDATE ON reponses_gouvernement
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();

-- Bureau d'âge publié sans date de fin (5 lignes en prod le 11/11/2026)
UPDATE "mandats"
SET "date_fin" = "date_debut"
WHERE "type_organe" = 'BUREAU' AND "qualite" ~* 'd[''’]âge' AND "date_fin" IS NULL;
