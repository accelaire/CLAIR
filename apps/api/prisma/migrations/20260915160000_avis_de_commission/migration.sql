-- Les avis de commission sur les amendements.
--
-- Avant qu'un texte passe en séance, la commission se réunit au titre des
-- articles 86, 88 ou 91 du Règlement pour dire ce qu'elle pense des amendements
-- qui y seront débattus. Elle ne les adopte pas — ils sont déposés sur le texte
-- qui part en séance, pas sur le sien : elle donne un avis, qui oriente le vote.
--
-- Cet avis n'existait nulle part. `amendements.sort` porte le sort FINAL
-- (« Rejeté », « Adopté », « Tombé »), c'est-à-dire ce que l'hémicycle a décidé.
-- Ce que la commission avait recommandé est une autre information, et c'est
-- l'écart entre les deux qui se lit.
--
-- 193 réunions de l'Assemblée sur 3 443 sont dans ce cas, chacune portant de
-- quelques dizaines à plusieurs centaines d'avis.

CREATE TABLE "avis_commission" (
    "id" TEXT NOT NULL,
    "reunion_id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "amendement_id" TEXT,
    "position" TEXT NOT NULL,
    "sens" TEXT NOT NULL,
    "place" TEXT,
    "auteur" TEXT,
    "groupe" TEXT,
    "ordre" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avis_commission_pkey" PRIMARY KEY ("id")
);

-- Un amendement n'apparaît qu'une fois par réunion : la clé rend l'ingestion
-- rejouable sans doublon.
CREATE UNIQUE INDEX "avis_commission_reunion_id_numero_key" ON "avis_commission"("reunion_id", "numero");
CREATE INDEX "avis_commission_amendement_id_idx" ON "avis_commission"("amendement_id");
CREATE INDEX "avis_commission_sens_idx" ON "avis_commission"("sens");

ALTER TABLE "avis_commission"
  ADD CONSTRAINT "avis_commission_reunion_id_fkey"
  FOREIGN KEY ("reunion_id") REFERENCES "reunions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Le tableau ne donne qu'un numéro, qui n'est unique qu'au sein d'un texte : le
-- rapprochement peut échouer, et l'avis reste lisible sans lui.
ALTER TABLE "avis_commission"
  ADD CONSTRAINT "avis_commission_amendement_id_fkey"
  FOREIGN KEY ("amendement_id") REFERENCES "amendements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
