-- Nature d'un scrutin : sur QUOI porte le vote.
--
-- `type_vote` (solennel / ordinaire / motion) décrit COMMENT on vote — c'est le
-- mode de scrutin publié par l'Assemblée. Il ne dit rien de l'objet voté : 99 %
-- des scrutins sont « ordinaires », qu'ils portent sur un amendement de séance
-- ou sur l'adoption finale d'une loi. Impossible, donc, d'isoler les votes qui
-- comptent — ce que la page dossier contournait jusqu'ici par un
-- `titre.includes("l'ensemble")` évalué côté client, sur la seule page chargée.
--
-- Aucune des deux chambres ne publie l'objet sous forme machine : la valeur est
-- déduite de `objet_libelle` à l'ingestion (voir
-- services/ingestion/src/utils/nature-scrutin.ts), qui classe 99,8 % du corpus.
--
-- Nullable à dessein : NULL signifie « pas encore classé », ce qui permet à la
-- commande `backfill-nature-vote` de rattraper l'historique par lots et au
-- smart-sync de se rattraper tout seul, sans réécrire 21 731 lignes ici.

ALTER TABLE "scrutins" ADD COLUMN "nature_vote" TEXT;

CREATE INDEX "scrutins_nature_vote_idx" ON "scrutins"("nature_vote");
