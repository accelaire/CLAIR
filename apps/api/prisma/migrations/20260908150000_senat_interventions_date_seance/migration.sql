-- Recale les interventions du Sénat sur leur date de séance.
--
-- Le client construisait la date avec `new Date(year, month - 1, day)`, soit
-- minuit dans le fuseau local, enregistré `23:00:00` la veille en hiver et
-- `22:00:00` en été. Les 91 017 interventions du Sénat portaient la date du
-- jour précédent ; l'Assemblée, elle, est à minuit pile.
--
-- Le décalage ne se voyait pas à l'écran mais cassait tout rapprochement par
-- la date : scrutins du jour sur la fiche, regroupement par séance, et la
-- segmentation publiée par le Sénat, qui ne retrouvait que 13,6 % de nos
-- interventions au lieu de 75,9 %.
--
-- `seance_id` (`d20260225`) est la source de vérité : il vient du nom du
-- fichier de séance et n'a jamais été altéré.

UPDATE "interventions"
SET "date" = to_date(substring("seance_id" from 2), 'YYYYMMDD')::timestamp
WHERE "chambre" = 'senat'
  AND "seance_id" ~ '^d[0-9]{8}$'
  AND to_date(substring("seance_id" from 2), 'YYYYMMDD') <> "date"::date;
