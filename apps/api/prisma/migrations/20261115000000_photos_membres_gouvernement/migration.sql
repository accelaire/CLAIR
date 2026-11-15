-- Photos des membres du Gouvernement sans fiche (#136).
--
-- Migration additive : six colonnes nullables sur `membres_gouvernement`, sans
-- valeur par défaut ni index. L'ajout ne réécrit pas la table et ne prend qu'un
-- verrou bref. Le code déjà déployé ne lit ni n'écrit ces colonnes (la synchro
-- des gouvernements ne met à jour que ses propres champs), elle peut donc être
-- jouée avant la fusion.

SET lock_timeout = '5s';

-- AlterTable
ALTER TABLE "membres_gouvernement" ADD COLUMN     "photo_auteur" TEXT,
ADD COLUMN     "photo_licence" TEXT,
ADD COLUMN     "photo_licence_url" TEXT,
ADD COLUMN     "photo_source" TEXT,
ADD COLUMN     "photo_url" TEXT,
ADD COLUMN     "wikidata_id" TEXT;
