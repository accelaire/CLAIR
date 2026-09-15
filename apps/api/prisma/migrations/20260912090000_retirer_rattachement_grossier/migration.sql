-- Retire le rattachement grossier d'une intervention à un scrutin.
--
-- Cette colonne désignait un scrutin au seul motif qu'il partageait la séance
-- ou la journée de la prise de parole. Une séance en porte dix en moyenne,
-- jusqu'à quatre-vingts : c'est ainsi que 214 277 interventions se sont
-- retrouvées liées au mauvais vote, et que la page d'un scrutin montrait le
-- débat d'un autre.
--
-- Elle est remplacée depuis par `intervention_scrutin`, qui lit les mises aux
-- voix du compte rendu et rend à chaque scrutin le débat qui l'a précédé.
-- Plus aucune lecture ne subsiste dans l'API, le front ni l'ingestion : la
-- colonne n'était plus qu'entretenue.

ALTER TABLE "interventions" DROP CONSTRAINT IF EXISTS "interventions_scrutin_id_fkey";
DROP INDEX IF EXISTS "interventions_scrutin_id_idx";
ALTER TABLE "interventions" DROP COLUMN IF EXISTS "scrutin_id";
