-- Statut particulier du votant au Sénat (ticket #108) : président de séance,
-- membre du gouvernement, congé… publié par DOSLEG (`votsen.stavotidt`). Ces
-- scrutins sortent du calcul de la présence : un président de séance ou un
-- ministre ne peut pas voter.
--
-- Ajout d'une colonne nullable, sans défaut ni réécriture de la table : la
-- migration passe avant la fusion, le code déployé l'ignore. Remplie au
-- prochain passage des scrutins du Sénat.

SET lock_timeout = '5s';

ALTER TABLE "votes" ADD COLUMN "statut_votant" TEXT;
