-- Horodatage des lignes : `created_at` et `updated_at` sur toutes les tables,
-- `updated_at` maintenu par la base (ticket #95, Data for Good).
--
-- 1. Les colonnes. `ADD COLUMN … NOT NULL DEFAULT CURRENT_TIMESTAMP` ne
--    réécrit pas la table : Postgres évalue le défaut une fois et le sert à
--    toutes les lignes existantes (mesuré sur 3,9 M de votes : 1,3 ms, 55 kB
--    de WAL). Les lignes antérieures portent donc la date de la migration,
--    qui se lit « au plus tard à la mise en service du suivi » : vrai pour
--    toutes. Les remplir avec `created_at` aurait réécrit les plus grosses
--    tables (3,7 Go de WAL et une table doublée pour les seuls votes) pour une
--    date fausse sur les lignes modifiées depuis leur création. Les 15 tables
--    qui avaient déjà `updated_at` gardent leurs valeurs et gagnent un défaut,
--    dont les `INSERT` en SQL brut ont besoin depuis que Prisma ne le remplit
--    plus (`@updatedAt` retiré du schéma).
--
-- 2. Les triggers, copie de `prisma/triggers.sql` à la date de la migration
--    (le fichier peut évoluer, une migration jamais). Ils viennent APRÈS les
--    colonnes : ils les supposent.
--
-- `lock_timeout` : chaque ALTER prend un verrou exclusif bref sur sa table. Si
-- une requête longue le fait attendre, mieux vaut échouer que de bloquer
-- derrière lui toutes les lectures de l'API. La migration s'exécute en une
-- transaction : un échec n'en laisse rien, et elle se relance telle quelle.

SET lock_timeout = '5s';

-- AlterTable
ALTER TABLE "parlementaires" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "parlementaires_identifiants" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "groupes_politiques" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "mandats_parlementaires" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "mandats" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "commissions" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "reunions" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "reunion_participants" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "evenements_institutionnels" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "declarations_hatvp" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "groupes_alliances" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "groupes_thematiques" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "circonscriptions" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "candidatures_listes" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "candidatures" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "candidats_mandats_locaux" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "resultats_tours" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "resultats_listes" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "dossiers_legislatifs" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "dossier_commissions" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "sujets" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "sujet_liens" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "scrutins" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "votes" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "interventions" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "amendements" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "avis_commission" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "textes_articles" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "lobbyistes" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "actions_lobby" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "secteurs" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "lobbyistes_secteurs" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "actions_secteurs" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "cible_types" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "action_descriptions" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "sync_logs" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "source_states" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "feedbacks" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "intervention_scrutin" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- =============================================================================
-- Triggers (copie de prisma/triggers.sql)
-- =============================================================================

CREATE OR REPLACE FUNCTION clair_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- L'horloge de la base, jamais celle du client : la règle de reprise d'un
    -- client repose sur `updated_at >= début de la transaction`.
    NEW.updated_at := now() AT TIME ZONE 'UTC';
    RETURN NEW;
  END IF;

  IF current_setting('clair.force_updated_at', true) = 'on' THEN
    NEW.updated_at := now() AT TIME ZONE 'UTC';
    RETURN NEW;
  END IF;

  -- La valeur que l'écriture propose pour `updated_at` ne compte pas : seule la
  -- comparaison du reste de la ligne décide.
  NEW.updated_at := OLD.updated_at;
  IF NEW IS NOT DISTINCT FROM OLD THEN
    RETURN NEW;
  END IF;

  -- La ligne diffère : reste à savoir si c'est seulement par les colonnes
  -- ignorées. Le passage par jsonb ne coûte qu'aux lignes réellement écrites
  -- différemment (~5 µs la ligne, mesuré).
  IF TG_NARGS > 0 AND (to_jsonb(NEW) - TG_ARGV) = (to_jsonb(OLD) - TG_ARGV) THEN
    RETURN NEW;
  END IF;

  NEW.updated_at := now() AT TIME ZONE 'UTC';
  RETURN NEW;
END $$;

-- Marque comme modifié le parent d'une liaison qui change : une liaison fait
-- partie du contenu de son parent (les cosignataires d'un amendement, les
-- secteurs d'un lobbyiste…). Sans le forçage, le trigger du parent annulerait
-- la mise à jour, puisque la ligne du parent elle-même n'a pas changé.
--
-- Trigger d'instruction, à tables de transition : une écriture de 1 000
-- liaisons met à jour chaque parent une fois. Les lignes ignorées par un
-- `ON CONFLICT DO NOTHING` ne figurent pas dans la table de transition, et une
-- mise à jour sans effet n'apparaît pas dans la différence des deux tables :
-- ni l'une ni l'autre ne marque le parent.
--
-- Arguments : table parente, colonne de la liaison qui pointe vers elle.
CREATE OR REPLACE FUNCTION clair_touch_parent() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  precedent text := current_setting('clair.force_updated_at', true);
  parents text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    parents := format('SELECT %I FROM nouvelles', TG_ARGV[1]);
  ELSIF TG_OP = 'DELETE' THEN
    parents := format('SELECT %I FROM anciennes', TG_ARGV[1]);
  ELSE
    parents := format(
      'SELECT %1$I FROM (SELECT * FROM nouvelles EXCEPT SELECT * FROM anciennes) n
       UNION SELECT %1$I FROM (SELECT * FROM anciennes EXCEPT SELECT * FROM nouvelles) a',
      TG_ARGV[1]);
  END IF;

  PERFORM set_config('clair.force_updated_at', 'on', true);
  EXECUTE format('UPDATE %I p SET updated_at = p.updated_at WHERE p.id IN (%s)', TG_ARGV[0], parents);
  PERFORM set_config('clair.force_updated_at', coalesce(precedent, ''), true);
  RETURN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Un trigger par table. Les arguments sont les colonnes ignorées.
-- -----------------------------------------------------------------------------

-- Parlementaires et mandats : les stats et les fiches sont du contenu ; leur
-- date de calcul, l'empreinte des entrées de la fiche et sa date de génération
-- n'en sont pas (une fiche régénérée à l'identique n'a pas changé).
CREATE OR REPLACE TRIGGER parlementaires_updated_at BEFORE INSERT OR UPDATE ON parlementaires
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at('stats_calculated_at', 'ia_content_hash', 'ia_generated_at');
CREATE OR REPLACE TRIGGER parlementaires_identifiants_updated_at BEFORE INSERT OR UPDATE ON parlementaires_identifiants
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER mandats_parlementaires_updated_at BEFORE INSERT OR UPDATE ON mandats_parlementaires
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at('stats_calculated_at');
CREATE OR REPLACE TRIGGER mandats_updated_at BEFORE INSERT OR UPDATE ON mandats
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER declarations_hatvp_updated_at BEFORE INSERT OR UPDATE ON declarations_hatvp
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();

-- Groupes : mêmes règles que les parlementaires pour les stats.
CREATE OR REPLACE TRIGGER groupes_politiques_updated_at BEFORE INSERT OR UPDATE ON groupes_politiques
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at('stats_calculated_at');
CREATE OR REPLACE TRIGGER groupes_alliances_updated_at BEFORE INSERT OR UPDATE ON groupes_alliances
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at('calculated_at');
CREATE OR REPLACE TRIGGER groupes_thematiques_updated_at BEFORE INSERT OR UPDATE ON groupes_thematiques
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at('calculated_at');

-- Commissions, réunions, agenda.
CREATE OR REPLACE TRIGGER commissions_updated_at BEFORE INSERT OR UPDATE ON commissions
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER reunions_updated_at BEFORE INSERT OR UPDATE ON reunions
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER reunion_participants_updated_at BEFORE INSERT OR UPDATE ON reunion_participants
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER evenements_institutionnels_updated_at BEFORE INSERT OR UPDATE ON evenements_institutionnels
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();

-- Sénatoriales. `verifie_a` est la date de la dernière lecture, qu'elle ait
-- changé quelque chose ou non.
CREATE OR REPLACE TRIGGER circonscriptions_updated_at BEFORE INSERT OR UPDATE ON circonscriptions
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER candidatures_listes_updated_at BEFORE INSERT OR UPDATE ON candidatures_listes
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER candidatures_updated_at BEFORE INSERT OR UPDATE ON candidatures
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER candidats_mandats_locaux_updated_at BEFORE INSERT OR UPDATE ON candidats_mandats_locaux
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER resultats_tours_updated_at BEFORE INSERT OR UPDATE ON resultats_tours
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at('verifie_a');
CREATE OR REPLACE TRIGGER resultats_listes_updated_at BEFORE INSERT OR UPDATE ON resultats_listes
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();

-- Dossiers, sujets, textes. Les empreintes IA et de contexte ne bougent que si
-- leurs entrées changent, mais elles bougent aussi quand on change la façon de
-- les calculer : ce sont des outils, pas des données.
CREATE OR REPLACE TRIGGER dossiers_legislatifs_updated_at BEFORE INSERT OR UPDATE ON dossiers_legislatifs
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at('ia_content_hash', 'ia_generated_at');
CREATE OR REPLACE TRIGGER dossier_commissions_updated_at BEFORE INSERT OR UPDATE ON dossier_commissions
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER sujets_updated_at BEFORE INSERT OR UPDATE ON sujets
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at(
    'ia_content_hash', 'ia_generated_at', 'ia_groupe_amendement_hash', 'context_input_hash', 'context_resolved_at');
CREATE OR REPLACE TRIGGER sujet_liens_updated_at BEFORE INSERT OR UPDATE ON sujet_liens
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER textes_articles_updated_at BEFORE INSERT OR UPDATE ON textes_articles
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();

-- Scrutins, votes, débats, amendements. `source_hash` est l'empreinte de ce
-- que l'ingestion a écrit, pas une donnée de la source.
CREATE OR REPLACE TRIGGER scrutins_updated_at BEFORE INSERT OR UPDATE ON scrutins
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at('source_hash', 'ia_content_hash', 'ia_generated_at');
CREATE OR REPLACE TRIGGER votes_updated_at BEFORE INSERT OR UPDATE ON votes
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER interventions_updated_at BEFORE INSERT OR UPDATE ON interventions
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER intervention_scrutin_updated_at BEFORE INSERT OR UPDATE ON intervention_scrutin
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER amendements_updated_at BEFORE INSERT OR UPDATE ON amendements
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at('source_hash');
CREATE OR REPLACE TRIGGER avis_commission_updated_at BEFORE INSERT OR UPDATE ON avis_commission
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();

-- Lobbying (HATVP).
CREATE OR REPLACE TRIGGER lobbyistes_updated_at BEFORE INSERT OR UPDATE ON lobbyistes
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER actions_lobby_updated_at BEFORE INSERT OR UPDATE ON actions_lobby
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER secteurs_updated_at BEFORE INSERT OR UPDATE ON secteurs
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER lobbyistes_secteurs_updated_at BEFORE INSERT OR UPDATE ON lobbyistes_secteurs
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER actions_secteurs_updated_at BEFORE INSERT OR UPDATE ON actions_secteurs
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER cible_types_updated_at BEFORE INSERT OR UPDATE ON cible_types
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER action_descriptions_updated_at BEFORE INSERT OR UPDATE ON action_descriptions
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();

-- Journaux de l'ingestion et retours des visiteurs : chaque écriture y est
-- du contenu.
CREATE OR REPLACE TRIGGER sync_logs_updated_at BEFORE INSERT OR UPDATE ON sync_logs
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER source_states_updated_at BEFORE INSERT OR UPDATE ON source_states
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER feedbacks_updated_at BEFORE INSERT OR UPDATE ON feedbacks
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();

-- -----------------------------------------------------------------------------
-- Liaisons qui marquent leur parent comme modifié.
-- -----------------------------------------------------------------------------
-- Les cosignataires font partie de l'amendement ; un rattachement à un scrutin
-- se lit sur l'amendement comme sur le scrutin ; les secteurs d'un lobbyiste
-- et d'une action, la liste des présents d'une réunion font partie de leur
-- fiche. `intervention_scrutin` ne marque personne : c'est un index que les
-- linkers recalculent, suivi par son propre `updated_at`.
--
-- Les tables M:N implicites de Prisma (`_Amendement…`) n'ont pas de colonne
-- `updated_at` : Prisma gère leur structure et `db push` en retirerait une.

CREATE OR REPLACE TRIGGER cosignataires_touch_amendement_ins AFTER INSERT ON "_AmendementCosignataires"
  REFERENCING NEW TABLE AS nouvelles FOR EACH STATEMENT EXECUTE FUNCTION clair_touch_parent('amendements', 'A');
CREATE OR REPLACE TRIGGER cosignataires_touch_amendement_upd AFTER UPDATE ON "_AmendementCosignataires"
  REFERENCING OLD TABLE AS anciennes NEW TABLE AS nouvelles FOR EACH STATEMENT EXECUTE FUNCTION clair_touch_parent('amendements', 'A');
CREATE OR REPLACE TRIGGER cosignataires_touch_amendement_del AFTER DELETE ON "_AmendementCosignataires"
  REFERENCING OLD TABLE AS anciennes FOR EACH STATEMENT EXECUTE FUNCTION clair_touch_parent('amendements', 'A');

CREATE OR REPLACE TRIGGER amendement_scrutin_touch_amendement_ins AFTER INSERT ON "_AmendementToScrutin"
  REFERENCING NEW TABLE AS nouvelles FOR EACH STATEMENT EXECUTE FUNCTION clair_touch_parent('amendements', 'A');
CREATE OR REPLACE TRIGGER amendement_scrutin_touch_amendement_upd AFTER UPDATE ON "_AmendementToScrutin"
  REFERENCING OLD TABLE AS anciennes NEW TABLE AS nouvelles FOR EACH STATEMENT EXECUTE FUNCTION clair_touch_parent('amendements', 'A');
CREATE OR REPLACE TRIGGER amendement_scrutin_touch_amendement_del AFTER DELETE ON "_AmendementToScrutin"
  REFERENCING OLD TABLE AS anciennes FOR EACH STATEMENT EXECUTE FUNCTION clair_touch_parent('amendements', 'A');
CREATE OR REPLACE TRIGGER amendement_scrutin_touch_scrutin_ins AFTER INSERT ON "_AmendementToScrutin"
  REFERENCING NEW TABLE AS nouvelles FOR EACH STATEMENT EXECUTE FUNCTION clair_touch_parent('scrutins', 'B');
CREATE OR REPLACE TRIGGER amendement_scrutin_touch_scrutin_upd AFTER UPDATE ON "_AmendementToScrutin"
  REFERENCING OLD TABLE AS anciennes NEW TABLE AS nouvelles FOR EACH STATEMENT EXECUTE FUNCTION clair_touch_parent('scrutins', 'B');
CREATE OR REPLACE TRIGGER amendement_scrutin_touch_scrutin_del AFTER DELETE ON "_AmendementToScrutin"
  REFERENCING OLD TABLE AS anciennes FOR EACH STATEMENT EXECUTE FUNCTION clair_touch_parent('scrutins', 'B');

CREATE OR REPLACE TRIGGER lobbyistes_secteurs_touch_lobbyiste_ins AFTER INSERT ON lobbyistes_secteurs
  REFERENCING NEW TABLE AS nouvelles FOR EACH STATEMENT EXECUTE FUNCTION clair_touch_parent('lobbyistes', 'lobbyiste_id');
CREATE OR REPLACE TRIGGER lobbyistes_secteurs_touch_lobbyiste_upd AFTER UPDATE ON lobbyistes_secteurs
  REFERENCING OLD TABLE AS anciennes NEW TABLE AS nouvelles FOR EACH STATEMENT EXECUTE FUNCTION clair_touch_parent('lobbyistes', 'lobbyiste_id');
CREATE OR REPLACE TRIGGER lobbyistes_secteurs_touch_lobbyiste_del AFTER DELETE ON lobbyistes_secteurs
  REFERENCING OLD TABLE AS anciennes FOR EACH STATEMENT EXECUTE FUNCTION clair_touch_parent('lobbyistes', 'lobbyiste_id');

CREATE OR REPLACE TRIGGER actions_secteurs_touch_action_ins AFTER INSERT ON actions_secteurs
  REFERENCING NEW TABLE AS nouvelles FOR EACH STATEMENT EXECUTE FUNCTION clair_touch_parent('actions_lobby', 'action_id');
CREATE OR REPLACE TRIGGER actions_secteurs_touch_action_upd AFTER UPDATE ON actions_secteurs
  REFERENCING OLD TABLE AS anciennes NEW TABLE AS nouvelles FOR EACH STATEMENT EXECUTE FUNCTION clair_touch_parent('actions_lobby', 'action_id');
CREATE OR REPLACE TRIGGER actions_secteurs_touch_action_del AFTER DELETE ON actions_secteurs
  REFERENCING OLD TABLE AS anciennes FOR EACH STATEMENT EXECUTE FUNCTION clair_touch_parent('actions_lobby', 'action_id');

CREATE OR REPLACE TRIGGER reunion_participants_touch_reunion_ins AFTER INSERT ON reunion_participants
  REFERENCING NEW TABLE AS nouvelles FOR EACH STATEMENT EXECUTE FUNCTION clair_touch_parent('reunions', 'reunion_id');
CREATE OR REPLACE TRIGGER reunion_participants_touch_reunion_upd AFTER UPDATE ON reunion_participants
  REFERENCING OLD TABLE AS anciennes NEW TABLE AS nouvelles FOR EACH STATEMENT EXECUTE FUNCTION clair_touch_parent('reunions', 'reunion_id');
CREATE OR REPLACE TRIGGER reunion_participants_touch_reunion_del AFTER DELETE ON reunion_participants
  REFERENCING OLD TABLE AS anciennes FOR EACH STATEMENT EXECUTE FUNCTION clair_touch_parent('reunions', 'reunion_id');
