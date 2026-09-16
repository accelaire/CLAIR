-- Libellé de nuance publié par le ministère de l'Intérieur à partir de 2026.
-- Null pour les éditions antérieures, qui ne donnaient que le code.

-- AlterTable
ALTER TABLE "candidatures_listes" ADD COLUMN     "nuance_libelle" TEXT;
