-- Présence aux scrutins solennels sur toute la carrière (#108).
--
-- La fiche présente la carrière, mais sa présence solennelle venait du dernier
-- mandat : Gérard Collomb affichait 0 %, sur un seul scrutin pendant son mois de
-- retour au Sénat en 2018, à côté de 97 % tous scrutins sur sa carrière.
--
-- Uniquement un ajout de colonne, ignorée du code déployé : la migration peut
-- passer avant la fusion. La valeur est écrite au calcul des stats suivant ;
-- d'ici là, la fiche garde la présence solennelle actuelle.

SET lock_timeout = '5s';

ALTER TABLE "parlementaires" ADD COLUMN "stats_carriere_presence_solennel" INTEGER;
