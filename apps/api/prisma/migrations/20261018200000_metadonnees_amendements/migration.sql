-- Métadonnées des amendements publiées par les sources et jusqu'ici ignorées
-- (tickets #95 et #96) : alinéa visé, discussions communes et identiques,
-- date de modification à la source (chronotag AN), ordre d'appel, séance de
-- discussion, et l'amendement que modifie un sous-amendement.
--
-- Colonnes nullables sans défaut : ajout sans réécriture de la table. Les index
-- se construisent sur ~210 000 lignes (quelques secondes, écritures bloquées
-- pendant ce temps : à jouer hors du batch nocturne). Aucun trigger à ajouter :
-- le trigger d'horodatage de la table compte toute nouvelle colonne comme du
-- contenu.

SET lock_timeout = '5s';

-- AlterTable
ALTER TABLE "amendements" ADD COLUMN     "alinea" TEXT,
ADD COLUMN     "alinea_numero" INTEGER,
ADD COLUMN     "amendement_parent_id" TEXT,
ADD COLUMN     "amendement_parent_ref" TEXT,
ADD COLUMN     "chronotag" TIMESTAMP(3),
ADD COLUMN     "id_discussion_commune" TEXT,
ADD COLUMN     "id_discussion_identique" TEXT,
ADD COLUMN     "position_discussion_commune" TEXT,
ADD COLUMN     "position_discussion_identique" TEXT,
ADD COLUMN     "seance_discussion_ref" TEXT,
ADD COLUMN     "tri_amendement" TEXT;

-- CreateIndex
CREATE INDEX "amendements_amendement_parent_id_idx" ON "amendements"("amendement_parent_id");

-- CreateIndex
CREATE INDEX "amendements_chambre_id_discussion_commune_idx" ON "amendements"("chambre", "id_discussion_commune");

-- CreateIndex
CREATE INDEX "amendements_chambre_id_discussion_identique_idx" ON "amendements"("chambre", "id_discussion_identique");

-- AddForeignKey
ALTER TABLE "amendements" ADD CONSTRAINT "amendements_amendement_parent_id_fkey" FOREIGN KEY ("amendement_parent_id") REFERENCES "amendements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

