-- Seuil de scrutins pour entrer dans les classements de présence et de loyauté.
--
-- Depuis le renouvellement de septembre 2026, 179 sénateurs étaient classés sur
-- 28 scrutins : un taux sur si peu de votes n'a pas de sens comparé à celui
-- d'un élu noté sur des milliers. Le calcul des stats enregistre désormais le
-- nombre de scrutins sur lequel porte la présence, et si ce nombre atteint le
-- seuil (stats-calculator.ts, SEUIL_SCRUTINS_CLASSEMENT). Les classements
-- passent en fin de liste ceux qui ne l'atteignent pas ; la fiche garde le taux.
--
-- Uniquement des ajouts de colonnes, ignorées du code déployé : la migration
-- peut passer avant la fusion. Les valeurs sont écrites au calcul des stats
-- suivant ; d'ici là, personne n'est classable et les classements de présence
-- et de loyauté suivent l'ordre des taux, comme aujourd'hui.

SET lock_timeout = '5s';

ALTER TABLE "parlementaires"
  ADD COLUMN "stats_scrutins" INTEGER,
  ADD COLUMN "stats_carriere_scrutins" INTEGER,
  ADD COLUMN "stats_classable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stats_carriere_classable" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "mandats_parlementaires" ADD COLUMN "stats_scrutins" INTEGER;
