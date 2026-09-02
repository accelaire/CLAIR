-- Candidatures aux élections (lot B des sénatoriales 2026).
-- Voir SPEC-SENATORIALES-CANDIDATS.md, §3.
--
-- ATTENTION si vous régénérez ce fichier avec `prisma migrate diff` : la sortie
-- brute contient AUSSI un `DROP TABLE tmp_prod_uids` et trois `DROP INDEX`
-- (_AmendementCosignataires_B_A_idx, amendements_id_tri_idx,
-- scrutins_chambre_date_numero_idx). Ces index existent en prod, créés par des
-- migrations antérieures, mais ne sont pas déclarés dans schema.prisma : les
-- laisser passer les supprimerait en production. Ils ont été retirés à la main.

-- CreateTable
CREATE TABLE "candidatures_listes" (
    "id" TEXT NOT NULL,
    "scrutin" TEXT NOT NULL,
    "circonscription_id" TEXT NOT NULL,
    "mode_scrutin" TEXT NOT NULL,
    "numero_depot" INTEGER,
    "libelle" TEXT,
    "nuance" TEXT,
    "famille" TEXT,
    "source_uid" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidatures_listes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidatures" (
    "id" TEXT NOT NULL,
    "liste_id" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "sexe" TEXT,
    "annee_naissance" INTEGER,
    "date_naissance" TIMESTAMP(3),
    "profession_code" TEXT,
    "profession_label" TEXT,
    "sortant_declare" BOOLEAN NOT NULL DEFAULT false,
    "personne_id" TEXT,
    "match_confiance" TEXT,
    "elu" BOOLEAN NOT NULL DEFAULT false,
    "tour_election" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidatures_listes_source_uid_key" ON "candidatures_listes"("source_uid");

-- CreateIndex
CREATE INDEX "candidatures_listes_scrutin_circonscription_id_idx" ON "candidatures_listes"("scrutin", "circonscription_id");

-- CreateIndex
CREATE INDEX "candidatures_listes_scrutin_mode_scrutin_idx" ON "candidatures_listes"("scrutin", "mode_scrutin");

-- CreateIndex
CREATE INDEX "candidatures_personne_id_idx" ON "candidatures"("personne_id");

-- CreateIndex
CREATE INDEX "candidatures_nom_prenom_idx" ON "candidatures"("nom", "prenom");

-- CreateIndex
CREATE UNIQUE INDEX "candidatures_liste_id_role_ordre_key" ON "candidatures"("liste_id", "role", "ordre");

-- AddForeignKey
ALTER TABLE "candidatures_listes" ADD CONSTRAINT "candidatures_listes_circonscription_id_fkey" FOREIGN KEY ("circonscription_id") REFERENCES "circonscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidatures" ADD CONSTRAINT "candidatures_liste_id_fkey" FOREIGN KEY ("liste_id") REFERENCES "candidatures_listes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidatures" ADD CONSTRAINT "candidatures_personne_id_fkey" FOREIGN KEY ("personne_id") REFERENCES "parlementaires"("id") ON DELETE SET NULL ON UPDATE CASCADE;

