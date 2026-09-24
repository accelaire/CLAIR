-- Donne une identité stable aux prises de parole du Sénat.
--
-- L'AN livre un identifiant par intervention, et l'index unique sur
-- `source_uid` l'a toujours protégée des doublons. Le Sénat n'en livre aucun :
-- son compte rendu analytique n'offre que l'ancre `par_N` du paragraphe. Les
-- 316 111 prises du Sénat sont donc entrées en base avec `source_uid` à NULL,
-- hors de portée de l'index, dédoublonnées à la volée sur les 200 premiers
-- caractères du texte.
--
-- Cette clé se trompait dans les deux sens. Le Sénat republie ses journées
-- révisées pendant plusieurs jours : « nous nous opposons » corrigé en « nous
-- opposons » suffisait à rendre la prise méconnaissable, et la relecture de la
-- nuit suivante la réinsérait. À l'inverse, deux sénateurs disant « Il est
-- défendu, monsieur le président. » dans la même séance étaient confondus, et
-- le second n'était jamais écrit.
--
-- L'ingestion fige désormais le rang de la prise dans la séance
-- (`senat-cri-<journée>-<rang>`), que la source ne bouge pas quand elle corrige
-- une formulation, et converge vers la version publiée au lieu d'y ajouter.
-- Cette migration inscrit ce rang sur l'existant.
--
-- Elle ne touche pas aux 64 journées de 2026 où plusieurs prises se sont
-- empilées sur un même rang : le rang y a glissé d'une révision à l'autre, et
-- les départager après coup reviendrait à deviner. Leurs lignes restent à NULL,
-- donc reconnues comme antérieures à l'identité stable, et la synchro les
-- remplace par la version publiée à sa prochaine lecture — elles sont toutes
-- dans sa fenêtre. Rien n'est effacé ici : c'est l'ingestion qui reprend la
-- main, une journée à la fois, après avoir écrit la version de remplacement.

UPDATE "interventions" i
SET "source_uid" = 'senat-cri-' || i."seance_id" || '-' || i."ordre"
WHERE i."chambre" = 'senat'
  AND i."source_uid" IS NULL
  AND i."seance_id" IS NOT NULL
  AND i."ordre" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "interventions" j
    WHERE j."chambre" = 'senat'
      AND j."seance_id" = i."seance_id"
      AND j."ordre" = i."ordre"
      AND j."id" <> i."id"
  );
