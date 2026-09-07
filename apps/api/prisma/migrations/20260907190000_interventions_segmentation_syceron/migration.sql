-- Segmentation des débats AN (source syceron)
--
-- Jusqu'ici une page de scrutin ne pouvait afficher que la séance entière —
-- 945 interventions pour le seul scrutin 2076 — faute de savoir de quel
-- article ou de quel amendement une prise de parole traitait.
--
-- Ces colonnes portent le contexte publié par le compte rendu de l'AN, et
-- `intervention_scrutin` le rattachement qui en découle.
--
-- Rédigée à la main : `migrate diff` propose ici, en plus du changement voulu,
-- la suppression de quatre index et d'une clé étrangère absents du schéma mais
-- bien présents en production.

ALTER TABLE "interventions"
  ADD COLUMN "source_uid" TEXT,
  ADD COLUMN "seance_uid" TEXT,
  ADD COLUMN "ordre_absolu" INTEGER,
  ADD COLUMN "code_grammaire" TEXT,
  ADD COLUMN "article_vise" TEXT,
  ADD COLUMN "texte_numero" TEXT,
  ADD COLUMN "est_presidence" BOOLEAN NOT NULL DEFAULT false;

-- `source_uid` reste nullable : les interventions héritées de DILA n'en ont
-- pas, et PostgreSQL autorise autant de NULL que voulu sous un index unique.
CREATE UNIQUE INDEX "interventions_source_uid_key" ON "interventions"("source_uid");
CREATE INDEX "interventions_seance_uid_ordre_absolu_idx" ON "interventions"("seance_uid", "ordre_absolu");
CREATE INDEX "interventions_article_vise_idx" ON "interventions"("article_vise");

CREATE TABLE "intervention_scrutin" (
    "intervention_id" TEXT NOT NULL,
    "scrutin_id" TEXT NOT NULL,
    "via" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intervention_scrutin_pkey" PRIMARY KEY ("intervention_id","scrutin_id")
);

CREATE INDEX "intervention_scrutin_scrutin_id_via_idx" ON "intervention_scrutin"("scrutin_id", "via");

ALTER TABLE "intervention_scrutin" ADD CONSTRAINT "intervention_scrutin_intervention_id_fkey"
  FOREIGN KEY ("intervention_id") REFERENCES "interventions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "intervention_scrutin" ADD CONSTRAINT "intervention_scrutin_scrutin_id_fkey"
  FOREIGN KEY ("scrutin_id") REFERENCES "scrutins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
