-- Prises de parole en réunion de commission.
--
-- L'essentiel du travail législatif se fait en commission et rien n'en était
-- ingéré. Ces prises de parole rejoignent `interventions` plutôt qu'une table
-- jumelle : même forme, même affichage, mêmes orateurs. `reunion_id` est le
-- discriminant — `NULL` en séance publique — pour que les comptes et les
-- statistiques existants continuent de ne mesurer que l'hémicycle tant qu'on
-- n'a pas décidé le contraire.
--
-- `orateur_groupe` porte le sigle que le compte rendu de commission imprime
-- (« M. Charles Fournier (EcoS) ») ; la séance publique ne le donne pas, c'est
-- le mandat d'époque qui l'y apporte.

ALTER TABLE "interventions"
  ADD COLUMN "reunion_id" TEXT,
  ADD COLUMN "orateur_groupe" TEXT;

CREATE INDEX "interventions_reunion_id_ordre_idx" ON "interventions"("reunion_id", "ordre");

ALTER TABLE "interventions"
  ADD CONSTRAINT "interventions_reunion_id_fkey"
  FOREIGN KEY ("reunion_id") REFERENCES "reunions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
