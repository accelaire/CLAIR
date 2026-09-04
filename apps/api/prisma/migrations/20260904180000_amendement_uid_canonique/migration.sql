-- Clé canonique d'amendement, pour cesser d'ingérer deux fois le même.
--
-- L'Assemblée republie un amendement sous un nouvel uid quand le texte passe du
-- projet initial (B1364) au texte de la commission (BTC1364), et LAISSE les deux
-- fichiers dans son archive. Les deux JSON ne diffèrent que par l'uid, l'URI du
-- PDF qui en dérive, la date de publication et un horodatage interne : 346
-- amendements de la 17e législature sur 123 224 sont ainsi en double en base.
--
-- L'upsert d'ingestion cherchait `uid`, donc créait une seconde ligne. Il
-- cherchera désormais `uid_canonique`, l'uid privé de son `TC`. L'uid brut reste
-- stocké tel que reçu de la source.

-- 1. La colonne, d'abord nullable : l'unicité ne peut être posée qu'après la fusion.
ALTER TABLE "amendements" ADD COLUMN "uid_canonique" TEXT;

UPDATE "amendements"
SET "uid_canonique" = regexp_replace("uid", 'BTC([0-9]+)P0D', 'B\1P0D');

-- 2. Fusion des doublons : on garde la ligne dont l'uid porte le TC, cohérente
--    avec son propre `texte_ref` (les 692 lignes concernées l'ont en forme BTC)
--    et republiée la plus récemment par l'AN.
--
--    La suppression est volontairement conditionnée à l'identité stricte du
--    contenu. Si une paire divergeait, ses deux lignes survivraient et l'index
--    unique de l'étape 3 échouerait — la migration entière serait annulée
--    (le DDL PostgreSQL est transactionnel). C'est le comportement voulu : deux
--    amendements distincts sous une même clé canonique sont une anomalie à
--    examiner, pas à écraser en silence.
WITH groupes AS (
  SELECT "uid_canonique"
  FROM "amendements"
  GROUP BY "uid_canonique"
  HAVING count(*) > 1
),
identiques AS (
  SELECT a."uid_canonique"
  FROM "amendements" a
  JOIN groupes g ON g."uid_canonique" = a."uid_canonique"
  GROUP BY a."uid_canonique"
  HAVING count(DISTINCT coalesce(a."dispositif", '')) = 1
     AND count(DISTINCT coalesce(a."expose_sommaire", '')) = 1
     AND count(DISTINCT coalesce(a."article_vise", '')) = 1
     AND count(DISTINCT coalesce(a."texte_ref", '')) = 1
     AND count(DISTINCT a."numero") = 1
     AND count(DISTINCT coalesce(a."sort", '')) = 1
     AND count(DISTINCT coalesce(a."auteur_ref", '')) = 1
     AND count(DISTINCT coalesce(a."parlementaire_id"::text, '')) = 1
     AND count(DISTINCT coalesce(a."dossier_id"::text, '')) = 1
)
DELETE FROM "amendements" a
USING identiques i
WHERE a."uid_canonique" = i."uid_canonique"
  -- La survivante est celle dont l'uid porte le TC ; on supprime donc celle dont
  -- l'uid est déjà la forme canonique. Restreint aux groupes en doublon par la
  -- jointure : hors doublon, `uid = uid_canonique` est vrai partout.
  AND a."uid" = a."uid_canonique";

-- 3. Verrouillage.
ALTER TABLE "amendements" ALTER COLUMN "uid_canonique" SET NOT NULL;
CREATE UNIQUE INDEX "amendements_uid_canonique_key" ON "amendements"("uid_canonique");
