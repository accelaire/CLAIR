-- Provenance des sources web utilisées pour l'enrichissement IA d'une fiche.
--
-- Depuis le passage de Tavily à Wikidata, chaque fiche parlementaire devient
-- traçable : on stocke l'URL et l'horodatage de chaque source consultée, ex.
--   { "wikipedia": { "url": "...", "fetchedAt": "..." },
--     "wikidata":  { "url": "https://www.wikidata.org/wiki/Q...", "fetchedAt": "..." } }
--
-- Colonne nullable : ajout à chaud, sans downtime. Le worker l'écrit en
-- best-effort (update découplé), donc la génération fonctionne avec ou sans elle.
ALTER TABLE "parlementaires" ADD COLUMN IF NOT EXISTS "ia_sources" JSONB;
