-- Les réponses des membres du Gouvernement ne sont pas des questions posées.
--
-- Le compte rendu range questions et réponses sous la même rubrique. L'Assemblée
-- les distingue depuis 1aad245 par la qualité imprimée de l'orateur ; le Sénat
-- ne le faisait pas : chaque réponse d'un ministre qui est aussi sénateur
-- entrait dans son compteur « Questions posées ». Mesuré en prod le 24/10/2026 :
-- 12 194 lignes du Sénat, sur 26 fiches ; Sébastien Lecornu en affichait 454,
-- qui étaient toutes des réponses de ministre ou de Premier ministre.
--
-- L'ingestion (synchro du Sénat et segmentation de ses débats) pose désormais
-- le bon type ; cette migration corrige les lignes déjà en base, toutes
-- chambres confondues. Le motif est `QUALITE_GOUVERNEMENT_SQL`
-- (services/ingestion/src/utils/interventions.ts), qui retient exactement les
-- mêmes qualités que la règle de l'ingestion sur les 4 064 qualités distinctes
-- de la prod. Les compteurs suivent au calcul des stats de la nuit.

SET lock_timeout = '5s';

UPDATE "interventions"
SET "type" = 'reponse_gouvernement'
WHERE "type" = 'question'
  AND "orateur_qualite" ~* '\m(ministres?|secr[éeÉE]taire\s+d[''’]?[éeÉE]tat|garde\s+des\s+sceaux|porte-parole\s+du\s+gouvernement)\M';
