-- Supprime la contrainte unique (parlementaire_id, organe_ref) pour autoriser
-- les mandats historiques multiples sur la même commission pour un même parlementaire.
-- Un député peut avoir été membre, puis président, puis avoir quitté et rejoint — chaque
-- passage est conservé avec ses dates.
DROP INDEX IF EXISTS "mandats_parlementaire_id_organe_ref_key";

-- Index composite pour les requêtes membres actuels/historiques
CREATE INDEX IF NOT EXISTS "mandats_parlementaire_id_organe_ref_date_fin_idx"
  ON "mandats"("parlementaire_id", "organe_ref", "date_fin");
