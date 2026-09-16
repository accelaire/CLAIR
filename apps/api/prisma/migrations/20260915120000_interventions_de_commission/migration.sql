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

-- `dossier_id` résout le texte en discussion. Le compte rendu ne le nomme que
-- par son numéro de dépôt (« 1364 »), qui ne dit rien au lecteur ; le résoudre
-- à la lecture coûtait 5,8 s par requête, parce qu'il faut balayer les 189 734
-- amendements — eux seuls portent le lien entre un numéro de texte et un
-- dossier. On le pose donc une fois pour toutes.

ALTER TABLE "interventions"
  ADD COLUMN "reunion_id" TEXT,
  ADD COLUMN "orateur_groupe" TEXT,
  ADD COLUMN "dossier_id" TEXT;

CREATE INDEX "interventions_reunion_id_ordre_idx" ON "interventions"("reunion_id", "ordre");
CREATE INDEX "interventions_dossier_id_idx" ON "interventions"("dossier_id");

ALTER TABLE "interventions"
  ADD CONSTRAINT "interventions_reunion_id_fkey"
  FOREIGN KEY ("reunion_id") REFERENCES "reunions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "interventions"
  ADD CONSTRAINT "interventions_dossier_id_fkey"
  FOREIGN KEY ("dossier_id") REFERENCES "dossiers_legislatifs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
