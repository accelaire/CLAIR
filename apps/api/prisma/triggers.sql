-- =============================================================================
-- Horodatage des lignes : `updated_at` maintenu par la base
-- =============================================================================
--
-- Joué par `pnpm db:push` (bases locales, CI) juste après `prisma db push`, qui
-- ne connaît pas les triggers, et repris tel quel par la migration
-- `20261018000000_horodatage_des_lignes` en production. Idempotent : on peut le
-- rejouer autant de fois qu'on veut.
--
-- CE QUE GARANTIT `updated_at`. La date du dernier changement de CONTENU de la
-- ligne, quelle que soit l'origine de l'écriture : Prisma, `$executeRaw` de
-- l'ingestion, SQL écrit à la main en production. Une réécriture à l'identique
-- la laisse en place : l'ingestion réécrit chaque nuit des centaines de
-- milliers de lignes inchangées (mesuré le 17/10/2026 : 100 % des lobbyistes,
-- 64 % des dossiers, 42 % des parlementaires), et un `updated_at` naïf les
-- aurait toutes déclarées modifiées.
--
-- LA DATE EST CELLE DU DÉBUT DE LA TRANSACTION (`now()`), en UTC, quel que
-- soit le fuseau de la session. `clock_timestamp()` ne dirait pas mieux quand
-- une ligne devient visible (c'est au COMMIT), et `now()` donne la même date à
-- toutes les lignes d'un même changement. Un client qui synchronise par
-- `updated_at` doit donc repartir de `least(instant du dump, début de la plus
-- ancienne transaction ouverte à cet instant)`, tronqué à la milliseconde (la
-- colonne est en `timestamp(3)`, Postgres arrondit) : voir
-- `docs/02-donnees/suivi-des-modifications.mdx`.
--
-- CE QUI N'EST PAS DU CONTENU. Les colonnes qui décrivent notre traitement et
-- bougent sans que la donnée change (date de calcul des stats, empreintes de
-- contenu ou de source, date de génération IA, date de vérification) sont
-- passées en arguments du trigger : un changement qui ne porte que sur elles
-- ne compte pas. Toute autre colonne, y compris une colonne ajoutée plus tard,
-- compte par défaut.
--
-- FORCER LA DATE. `SET LOCAL clair.force_updated_at = 'on'` fait dater toutes
-- les lignes écrites ensuite dans la transaction, même inchangées. C'est ce
-- que font les liaisons (plus bas) pour marquer leur parent. Pour insérer des
-- lignes en gardant leur `updated_at` d'origine (reprise de données), il faut
-- désactiver les triggers : `SET session_replication_role = replica`.
--
-- Ne jamais renvoyer NULL pour sauter une écriture sans effet : Prisma lit la
-- ligne écrite par `RETURNING` et lèverait P2025 (« record not found »).
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
