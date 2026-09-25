-- Suppression de la table `promesses`, jamais utilisée.
--
-- Elle date des débuts du schéma (fact-checking des promesses électorales) et
-- n'a jamais eu ni code d'ingestion, ni route d'API, ni page : aucun fichier du
-- dépôt ne la lit ni ne l'écrit. Vérifié le 25/09/2026 : 0 ligne en production
-- comme en local, aucune clé étrangère ni vue qui en dépende.
--
-- Aucune migration ne l'a créée (elle vient d'un `db push` antérieur à
-- l'historique), d'où le IF EXISTS : la migration reste sans effet sur une base
-- qui ne l'aurait pas.

DROP TABLE IF EXISTS "promesses";
