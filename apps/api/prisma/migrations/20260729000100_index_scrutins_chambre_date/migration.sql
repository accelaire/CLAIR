-- Index de parcours « derniers scrutins d'une chambre ».
--
-- `scrutins` n'avait que des index à colonne unique (chambre, puis date). Pour
-- « les 20 derniers scrutins de l'Assemblée où le groupe X a voté », Postgres
-- devait trier l'ensemble de la chambre avant d'en garder 20. Ce composite lui
-- permet de remonter le temps et de s'arrêter dès le vingtième trouvé.
--
-- Mesuré : 20 ms -> 2 ms pour un groupe actif (RN). Sans effet sur un groupe
-- éteint (LaREM), où il faut de toute façon remonter loin avant de trouver 20
-- scrutins le concernant.
CREATE INDEX IF NOT EXISTS "scrutins_chambre_date_numero_idx"
  ON "scrutins" ("chambre", "date" DESC, "numero" DESC);
