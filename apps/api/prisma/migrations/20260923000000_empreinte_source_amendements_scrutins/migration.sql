-- Empreinte de ce que la synchro nocturne écrit, pour ne réécrire que ce qui a
-- changé.
--
-- L'AN republie chaque nuit l'intégralité de ses amendements et de ses
-- scrutins. La synchro les réécrivait tous : 125 000 amendements (deux heures
-- du batch de 5 h) et, pour les 2 600 scrutins de la fenêtre quotidienne, la
-- suppression puis la réinsertion de 1,5 million de votes nominatifs — pour
-- quelques centaines de lignes qui avaient réellement bougé.
--
-- Colonnes nullables et sans valeur : la première nuit réécrit tout, comme
-- avant, et pose l'empreinte ; les suivantes sautent ce qui n'a pas changé.

ALTER TABLE "amendements" ADD COLUMN "source_hash" TEXT;
ALTER TABLE "scrutins" ADD COLUMN "source_hash" TEXT;
