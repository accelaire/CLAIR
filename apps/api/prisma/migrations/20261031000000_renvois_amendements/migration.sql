-- Renvois au droit en vigueur repérés dans le dispositif des amendements (T5,
-- ticket #46). Table vide, remplie ensuite par `sync-renvois-legi`. La clé
-- étrangère ne pose qu'un verrou bref sur `amendements` : la table qui la porte
-- est vide, rien à valider.
--
-- Le trigger d'horodatage est celui de `prisma/triggers.sql`, copié ici (une
-- migration ne doit pas dépendre d'un fichier qui évolue).

-- CreateTable
CREATE TABLE "amendements_renvois" (
    "amendement_id" TEXT NOT NULL,
    "renvois" JSONB NOT NULL,
    "version" INTEGER NOT NULL,
    "calcule_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amendements_renvois_pkey" PRIMARY KEY ("amendement_id")
);

-- AddForeignKey
ALTER TABLE "amendements_renvois" ADD CONSTRAINT "amendements_renvois_amendement_id_fkey" FOREIGN KEY ("amendement_id") REFERENCES "amendements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Horodatage
CREATE OR REPLACE TRIGGER amendements_renvois_updated_at BEFORE INSERT OR UPDATE ON amendements_renvois
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at('version', 'calcule_le');
