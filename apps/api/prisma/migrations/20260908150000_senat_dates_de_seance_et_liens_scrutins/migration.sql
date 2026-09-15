-- Recale les dates de séance du Sénat et purge les rattachements arbitraires.
--
-- Les deux recalages sont dans le même fichier à dessein : interventions et
-- scrutins du Sénat portaient le MÊME décalage d'un jour, donc les
-- rapprochements par date fonctionnaient par compensation. Corriger un seul
-- côté les désolidariserait et ferait tomber à zéro ce qui marchait encore.
-- Ils bougent ensemble ou pas du tout.

-- ---------------------------------------------------------------------------
-- 1. Interventions du Sénat
-- ---------------------------------------------------------------------------
-- Le client construisait la date avec `new Date(year, month - 1, day)`, soit
-- minuit dans le fuseau local, enregistré `23:00:00` la veille en hiver et
-- `22:00:00` en été. L'Assemblée, elle, est à minuit pile.
--
-- `seance_id` (`d20260225`) fait foi : il vient du nom du fichier de séance et
-- n'a jamais été altéré.

UPDATE "interventions"
SET "date" = to_date(substring("seance_id" from 2), 'YYYYMMDD')::timestamp
WHERE "chambre" = 'senat'
  AND "seance_id" ~ '^d[0-9]{8}$'
  AND to_date(substring("seance_id" from 2), 'YYYYMMDD') <> "date"::date;

-- ---------------------------------------------------------------------------
-- 2. Scrutins du Sénat
-- ---------------------------------------------------------------------------
-- Même bug de fuseau, source différente : `scrutins.date` vient de
-- `parseTimestamp()` dans `sources/senat/dosleg-client.ts`, qui lisait le champ
-- `scrdat` du dump DOSLEG ("2026-06-10 00:00:00", sans fuseau) avec
-- `new Date(ts)`. Sans "T" ni fuseau, JS interprète la chaîne dans le fuseau
-- LOCAL du process. (Le scraping HTML de `scrutins-client.ts` portait le même
-- défaut de construction, mais il est mort — jamais appelé depuis
-- `getScrutins()` — donc sans effet sur les données en base.)
--
-- Ici, aucune clé indépendante ne permet de reconstruire la vraie date :
-- `seance_ref` est NULL pour tous les scrutins du Sénat et `source_data` ne
-- garde pas la chaîne brute. La correction s'appuie donc sur la régularité du
-- décalage, vérifiée en lecture avant d'écrire :
--   - aucun scrutin du Sénat n'est à minuit, tous sont à l'heure 22 ou 23 ;
--   - la bascule 22h/23h tombe exactement sur les changements d'heure légale
--     (2026-03-24 → 23h, 2026-03-29 → 22h ; 2025-10-22 → 22h, 2025-10-27 → 23h),
--     signature d'une conversion Europe/Paris → UTC et non d'un aléa de source.
--
-- Le filtre sur l'heure rend l'opération idempotente : une fois à minuit, les
-- lignes ne sont plus reprises.

UPDATE "scrutins"
SET "date" = date_trunc('day', "date") + INTERVAL '1 day'
WHERE "chambre" = 'senat'
  AND EXTRACT(HOUR FROM "date") IN (22, 23);

-- ---------------------------------------------------------------------------
-- 3. Rattachements intervention → scrutin attribués au hasard
-- ---------------------------------------------------------------------------
-- `linkInterventionsToScrutins` rattachait une prise de parole à un scrutin au
-- seul motif qu'ils partageaient la séance ou la journée. Une séance porte dix
-- scrutins en moyenne, jusqu'à quatre-vingts : le scrutin retenu était
-- arbitraire. Le garde-fou `NOT EXISTS` censé limiter la casse lisait le cliché
-- d'avant l'UPDATE et ne filtrait donc rien.
--
-- En production : 214 277 lignes portaient un `scrutin_id`, dont 19 519
-- seulement se justifient — celles dont la journée ne comptait qu'un scrutin.
-- Le 28/11/2024, 1 644 interventions pointaient un seul scrutin sur les 32 du
-- jour. Personne ne lit cette colonne : la purge est sans effet visible, elle
-- évite qu'un futur lecteur prenne ces liens pour argent comptant.
--
-- La fonction ne lie désormais plus que les séances et journées à scrutin
-- unique ; le prochain passage du cron reposera ces ~19 500 liens. Le
-- rattachement fin relève de `intervention_scrutin`, alimentée par la
-- segmentation du débat.

UPDATE "interventions" SET "scrutin_id" = NULL WHERE "scrutin_id" IS NOT NULL;
