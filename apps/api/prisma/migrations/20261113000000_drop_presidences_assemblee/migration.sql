-- Suppression de `presidences_assemblee`, remplacée par `presidences_chambre`.
--
-- La migration 20261111000000_bilan_gouvernement a créé `presidences_chambre`
-- (présidences de l'Assemblée et du Sénat) sans supprimer l'ancienne table,
-- pour que le code déployé avant la fusion de #130 continue de la lire. Depuis
-- la fusion, plus aucun code ne la lit ni ne l'écrit, et ses 7 lignes sont dans
-- `presidences_chambre` (chambre = 'assemblee'), alimentée chaque nuit par
-- `sync-gouvernements`.
--
-- Le DROP emporte ses index, son trigger d'horodatage et sa clé étrangère vers
-- `parlementaires`. Retirer cette clé prend un verrou bref sur `parlementaires` :
-- à jouer hors du batch nocturne.

SET lock_timeout = '5s';

-- DropForeignKey
ALTER TABLE "presidences_assemblee" DROP CONSTRAINT "presidences_assemblee_parlementaire_id_fkey";

-- DropTable
DROP TABLE "presidences_assemblee";
