-- Recalcule le hash d'entrée des liens « contexte » des sujets sur slug|status.
--
-- La résolution incrémentale (vie-publique via Tavily, Wikipédia) relançait la
-- recherche d'un sujet dès que md5(label|status) changeait. Or l'enrichissement
-- IA réécrit `label` avec le titre qu'il génère : la régénération du 07/10/2026
-- a ainsi remis 675 sujets en file pour une simple reformulation, sur un quota
-- Tavily de 1000 recherches par mois. L'ingestion hashe désormais slug|status.
--
-- Sans cette migration, le changement de formule invaliderait les 1 571 sujets
-- déjà résolus, et la nuit suivante les rechercherait tous de nouveau. On
-- inscrit donc le nouveau hash sur chaque sujet déjà résolu, comme s'il venait
-- de l'être.
--
-- Limite assumée : pour les 675 sujets dont le label a changé depuis leur
-- résolution, l'ancien label n'est plus en base, donc on ne peut pas savoir si
-- leur statut a lui aussi bougé. Un changement de statut survenu dans
-- l'intervalle ne déclenchera pas de nouvelle recherche. Leurs liens restent
-- en place, et le statut ne déplace pas la page vie-publique d'une loi. Les
-- sujets jamais résolus gardent un hash NULL et restent en file.

UPDATE "sujets"
SET "context_input_hash" = md5("slug" || '|' || "status")
WHERE "context_resolved_at" IS NOT NULL;
