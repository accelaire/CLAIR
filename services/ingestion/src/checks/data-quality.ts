// =============================================================================
// Data Quality Checks — Invariants & Threshold-based regression detection
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { LEGISLATURE_AN_COURANTE } from '../workers/mandats';

// =============================================================================
// Périmètre des taux de liaison
// =============================================================================
//
// Dossiers et amendements ne sont ingérés que pour la législature courante (AN)
// et le Sénat. Les scrutins des législatures historiques (15, 16) existent en
// base sans dossier ni amendement associé : les compter au dénominateur ferait
// mesurer le *périmètre d'ingestion* au lieu de la *qualité de liaison*.
// On restreint donc ces deux taux au périmètre où les sources liées existent.
// Voir SPEC-MULTI-LEGISLATURES.md (ticket #13).
const SCRUTINS_PERIMETRE_LIE = `(s.chambre = 'senat' OR s.legislature = ${LEGISLATURE_AN_COURANTE})`;

// Sessions Sénat pour lesquelles on ingère ET enrichit les amendements (période courante).
// Les scrutins historiques (< cette borne) n'ont AUCUN amendement en base — la source ne
// remonte pas si loin — donc les compter fausserait le taux de liaison. Borne PLANCHER
// stable : contrairement à `LEGISLATURE_AN_COURANTE`, elle ne s'incrémente jamais (les
// sessions futures 2025, 2026… sont toutes >= à ce plancher). Les dossiers, eux, se lient
// sur tout l'historique : scrutins ET dossiers Sénat sont ingérés sur la même fenêtre
// (`SENAT_SESSION_MIN`, cf. workers/mandats), donc leur taux n'a pas besoin de ce
// périmètre — à surveiller au premier run couvrant les sessions antérieures à 2020.
const SENAT_SESSION_AMENDEMENTS_MIN = '2024';

// Périmètre des vérifications qui comparent les AMENDEMENTS liés à un scrutin.
// Au Sénat, il faut en plus borner aux sessions dont les amendements sont ingérés :
// les scrutins antérieurs n'ont AUCUN amendement en base, donc les compter revient
// à mesurer le périmètre d'ingestion et non la qualité du rattachement.
const SCRUTINS_PERIMETRE_AMENDEMENTS =
  `((s.chambre = 'senat' AND s.session >= '${SENAT_SESSION_AMENDEMENTS_MIN}') OR s.legislature = ${LEGISLATURE_AN_COURANTE})`;

// =============================================================================
// Types
// =============================================================================

export interface ThresholdConfig {
  type: 'invariant' | 'threshold';
  label: string;
  min: number;
  max?: number;
  query: string;
}

export interface CheckResult {
  key: string;
  label: string;
  type: 'invariant' | 'threshold';
  expected: string;
  actual: number;
  passed: boolean;
}

export interface MultiAmendmentMismatch {
  scrutinId: string;
  chambre: string;
  expectedNumeros: string[];
  linkedNumeros: string[];
  missingNumeros: string[];
  extraNumeros: string[];
}

export interface MultiAmendmentChambreStats {
  total: number;
  correct: number;
  incorrect: number;
}

export interface MultiAmendmentReport {
  total: number;
  correct: number;
  incorrect: number;
  byChambre: Record<string, MultiAmendmentChambreStats>;
  mismatches: MultiAmendmentMismatch[];
}

export interface SujetLiensFamilleStats {
  totalLinks: number;
  sujetsCovered: number;
  coverageRate: number; // % de sujets actifs portant ≥1 lien de cette famille
}

export interface SujetLiensDeadLinkSample {
  sampled: number; // liens tirés au sort
  checked: number; // liens ayant renvoyé une réponse HTTP
  dead: number;    // réponses >= 400
  deadUrls: string[];
}

export interface SujetLiensReport {
  available: boolean; // false si la table n'existe pas encore (migration non appliquée)
  sujetsTotal: number;
  construction: SujetLiensFamilleStats;
  contexte: SujetLiensFamilleStats;
  deadLinks: SujetLiensDeadLinkSample | null; // null si le check HTTP n'a pas été demandé
}

export interface QualityReport {
  results: CheckResult[];
  multiAmendment: MultiAmendmentReport;
  sujetLiens: SujetLiensReport;
  passed: boolean;
  invariantsPassed: boolean;
  thresholdsPassed: boolean;
  duration: string;
}

// =============================================================================
// THRESHOLDS — Hardcoded quality checks
// =============================================================================

export const THRESHOLDS: Record<string, ThresholdConfig> = {
  // ---- Invariants (0 tolérance) ----
  orphan_votes: {
    type: 'invariant',
    label: 'Votes sans scrutin valide',
    min: 0,
    max: 0,
    query: `SELECT COUNT(*)::int AS value FROM votes v LEFT JOIN scrutins s ON v.scrutin_id = s.id WHERE s.id IS NULL`,
  },
  scrutins_without_votes: {
    type: 'invariant',
    label: 'Scrutins sans aucun vote',
    min: 0,
    max: 0,
    query: `SELECT COUNT(*)::int AS value FROM scrutins s WHERE NOT EXISTS (SELECT 1 FROM votes v WHERE v.scrutin_id = s.id)`,
  },
  duplicate_scrutins: {
    type: 'invariant',
    label: 'Doublons scrutins (numero+chambre+session)',
    min: 0,
    max: 0,
    query: `SELECT COUNT(*)::int AS value FROM (SELECT numero, chambre, session FROM scrutins GROUP BY numero, chambre, session HAVING COUNT(*) > 1) sub`,
  },
  duplicate_amendements: {
    type: 'invariant',
    label: 'Doublons amendements (uid)',
    min: 0,
    max: 0,
    query: `SELECT COUNT(*)::int AS value FROM (SELECT uid FROM amendements GROUP BY uid HAVING COUNT(*) > 1) sub`,
  },
  interventions_senat_rang_en_double: {
    type: 'invariant',
    label: 'Prises du Sénat empilées sur un même rang de séance',
    min: 0,
    max: 0,
    // Le Sénat ne numérote pas ses interventions : leur identité est le rang de
    // la prise dans la journée, figé dans `source_uid`. Deux lignes sur un même
    // rang signalent que la clé n'a pas joué — c'est ainsi que la republication
    // des comptes rendus révisés avait empilé 10 454 lignes sur 64 journées,
    // une copie de plus à chaque nuit de relecture.
    query: `SELECT COUNT(*)::int AS value FROM (SELECT seance_id, ordre FROM interventions WHERE chambre = 'senat' AND seance_id IS NOT NULL GROUP BY seance_id, ordre HAVING COUNT(*) > 1) sub`,
  },
  parlementaires_without_groupe: {
    type: 'invariant',
    label: 'Parlementaires actifs sans groupe',
    min: 0,
    max: 0,
    query: `SELECT COUNT(*)::int AS value FROM parlementaires WHERE actif = true AND groupe_id IS NULL`,
  },
  cross_chamber_links: {
    type: 'invariant',
    label: 'Liens scrutin-dossier inter-chambres',
    min: 0,
    max: 0,
    query: `SELECT COUNT(*)::int AS value FROM scrutins s JOIN dossiers_legislatifs d ON s.dossier_id = d.id WHERE (s.chambre = 'assemblee' AND d.uid LIKE 'SENAT%') OR (s.chambre = 'senat' AND d.uid NOT LIKE 'SENAT%')`,
  },
  cross_legislature_links: {
    type: 'invariant',
    label: 'Liens scrutin-dossier inter-législatures (AN)',
    min: 0,
    max: 0,
    // Un scrutin AN ne peut appartenir qu'à un dossier de sa propre législature.
    // Non nul = le matching a rattaché des scrutins à un dossier d'une autre
    // législature, faute de dossier ingéré pour la leur.
    query: `SELECT COUNT(*)::int AS value FROM scrutins s JOIN dossiers_legislatifs d ON s.dossier_id = d.id WHERE s.chambre = 'assemblee' AND d.uid NOT LIKE 'SENAT%' AND s.session ~ '^[0-9]+$' AND d.legislature <> s.session::int`,
  },
  amendements_uid_canonique_doublons: {
    type: 'invariant',
    label: 'Amendements en double sous une même clé canonique',
    min: 0,
    max: 0,
    // L'index unique sur `uid_canonique` rend ce compte structurellement nul.
    // Il est vérifié malgré tout : l'invariant documente la règle là où on la
    // lit, et signalerait immédiatement un index perdu lors d'une restauration
    // ou d'une migration jouée à la main.
    query: `SELECT COUNT(*)::int AS value FROM (SELECT uid_canonique FROM amendements GROUP BY uid_canonique HAVING COUNT(*) > 1) sub`,
  },
  interventions_date_seance: {
    type: 'invariant',
    label: 'Interventions dont la date contredit leur séance',
    min: 0,
    max: 0,
    // Le client Sénat construisait la date de séance dans le fuseau local :
    // `new Date(2026, 1, 25)` donne minuit à Paris, enregistré 23h00 UTC la
    // veille. Les 91 017 interventions du Sénat dataient du jour précédent —
    // 23h00 en hiver, 22h00 en été. Le décalage était invisible à l'écran mais
    // cassait tout rapprochement par la date : scrutins du jour, regroupement
    // par séance sur la fiche, et la segmentation publiée par le Sénat, qui ne
    // retrouvait que 13,6 % de nos interventions au lieu de 75,9 %.
    //
    // `chambre = 'senat'` : le format `dAAAAMMJJ` de `seance_id` n'existe que
    // côté Sénat (l'AN utilise un autre format, ex. `2026013`) ; la migration
    // qui a corrigé ces lignes portait déjà ce filtre, l'invariant devait le
    // porter aussi.
    query: `SELECT COUNT(*)::int AS value FROM interventions WHERE chambre = 'senat' AND seance_id ~ '^d[0-9]{8}$' AND to_date(substring(seance_id from 2), 'YYYYMMDD') <> date::date`,
  },
  scrutins_date_seance: {
    type: 'invariant',
    label: 'Scrutins du Sénat dont la date porte un décalage de fuseau',
    min: 0,
    max: 0,
    // Bug jumeau du précédent, autre source : `scrutins.date` pour le Sénat
    // vient de `parseTimestamp()` dans `dosleg-client.ts`, qui lisait le champ
    // `scrdat` du dump DOSLEG ("2026-06-10 00:00:00", sans fuseau) avec
    // `new Date(ts)` — interprété dans le fuseau local du process. Les 4 775
    // scrutins du Sénat en production étaient TOUS décalés d'un jour, jamais
    // à minuit (22h00 UTC en été, 23h00 en hiver).
    //
    // Faute de clé indépendante du type `seance_id` pour reconstruire la
    // vraie date (voir la migration `20260908150000_senat_dates_de_seance_et_liens_scrutins`),
    // la signature du bug sert elle-même de garde-fou : un scrutin du Sénat à
    // minuit est correct, un scrutin à 22h ou 23h a de nouveau le bug.
    query: `SELECT COUNT(*)::int AS value FROM scrutins WHERE chambre = 'senat' AND EXTRACT(HOUR FROM date) IN (22, 23)`,
  },

  cross_legislature_interventions_dossiers: {
    type: 'invariant',
    label: "Prises de parole rattachées au dossier d'une autre législature (AN)",
    min: 0,
    max: 0,
    // Même piège, sur le rattachement d'une prise de parole à son texte : le
    // numéro de dépôt repart de 1 à chaque législature. Une version antérieure
    // du linker n'en tenait pas compte, et la passe nocturne ne revoyait que
    // les liens vides : 53 093 prises des 15e et 16e sont restées rattachées à
    // des dossiers de la 17e. La législature du compte rendu se lit sur son
    // uid (`CRSANR5L15…`), celle du dossier sur le sien (`DLR5L17N…`).
    query: `SELECT COUNT(*)::int AS value
            FROM interventions i
            JOIN dossiers_legislatifs d ON d.id = i.dossier_id
            WHERE i.chambre = 'assemblee'
              AND i.seance_uid LIKE 'CRSANR5L%'
              AND d.uid LIKE 'DLR5L%'
              AND substring(i.seance_uid from 'CRSANR5L([0-9]+)')
                  <> substring(d.uid from 'DLR5L([0-9]+)N')`,
  },

  cross_legislature_amendements_dossiers: {
    type: 'invariant',
    label: "Amendements rattachés au dossier d'une autre législature (AN)",
    min: 0,
    max: 0,
    // Le dossier d'un scrutin, rattaché jadis par son seul numéro, est descendu
    // sur ses amendements puis sur tout leur texte : 518 amendements de la 17e
    // pointaient vers « Bioéthique » (15e) ou un dossier de la 16e. Les passes
    // de propagation ne revoyant que les vides, rien ne les corrigeait.
    query: `SELECT COUNT(*)::int AS value
            FROM amendements a
            JOIN dossiers_legislatifs d ON d.id = a.dossier_id
            WHERE a.chambre = 'assemblee'
              AND d.uid LIKE 'DLR5L%'
              AND substring(d.uid from 'DLR5L([0-9]+)N')::int <> a.legislature`,
  },

  cross_legislature_amendements: {
    type: 'invariant',
    label: 'Liens scrutin-amendement inter-législatures (AN)',
    min: 0,
    max: 0,
    // Même piège que ci-dessus, sur l'autre relation. Les textes sont
    // renumérotés à chaque législature : le texte n°3 existe en 15e, en 16e et
    // en 17e. Les deux chemins de rattachement (scraping HTML et CTE) ne
    // gardaient que le numéro de texte, préfixe de législature retiré — 531
    // scrutins de 2017-2024 se sont retrouvés rattachés à un amendement de 2024
    // ou 2026, et leurs résumés publiés décrivaient ce dernier.
    query: `SELECT COUNT(*)::int AS value FROM scrutins s JOIN "_AmendementToScrutin" j ON j."B" = s.id JOIN amendements a ON a.id = j."A" WHERE s.chambre = 'assemblee' AND s.legislature IS NOT NULL AND a.legislature <> s.legislature`,
  },
  resume_contredit_statut: {
    type: 'invariant',
    label: 'Résumés IA contredisant le statut du sujet',
    min: 0,
    max: 0,
    // Un sujet promulgué ou rejeté dont le résumé annonce une procédure encore
    // en cours = résumé figé sur l'état d'avancement du jour de sa génération.
    //
    // La formulation est volontairement étroite : « en cours d'année »,
    // « retiré en cours de route » ou « abandonné en cours de discussion » sont
    // parfaitement valides pour un texte promulgué. Seules sont retenues les
    // assertions portant sur l'inachèvement de la procédure elle-même.
    //
    // Le `.` remplace l'apostrophe : les résumés mélangent ' et ’.
    //
    // `en cours d'examen` est ancré à un sujet grammatical désignant CE texte.
    // Sans cet ancrage, il attrapait « cette motion cherchait à influencer une
    // résolution européenne en cours d'examen » — une phrase juste, sur un
    // AUTRE texte, dans le résumé d'un sujet correctement décrit comme rejeté.
    query: `SELECT COUNT(*)::int AS value FROM sujets
      WHERE actif = true
        AND status IN ('promulgue', 'rejete')
        AND resume IS NOT NULL
        AND resume ~* '(doit encore (être )?(promulgu|examin|adopt|vot|discut|débattu|passer)|n.a pas encore été (promulgu|adopt|examin|vot)|(ce |le |la |cette )?(texte|proposition|projet|loi|résolution) (est |reste |demeure )?(toujours |encore )?en cours d.examen|examen (est |se poursuit)?(encore )?en cours|sera (prochainement )?examiné|en cours de promulgation|doit désormais être examiné)'`,
  },

  evenements_a_revoir: {
    type: 'invariant',
    label: 'Événements à date imprécise dont le mois est passé',
    min: 0,
    max: 0,
    // Les événements institutionnels sont une liste curée à la main : rien ne les
    // rafraîchit tout seul. Quand une échéance porte `date_precise = false`, sa
    // date n'est pas encore fixée par décret et l'UI n'affiche que le mois. Une
    // fois ce mois écoulé, deux cas seulement : le décret est paru et il faut
    // inscrire la vraie date, ou l'échéance a bougé. Dans les deux cas le site
    // ment (« Courant avril 2027 » affiché en mai 2027).
    //
    // Cet invariant remplace la mémoire de quelqu'un par un échec du batch de 5h.
    // Il se résout en éditant `services/ingestion/src/workers/evenements.ts`.
    query: `SELECT COUNT(*)::int AS value FROM evenements_institutionnels
      WHERE date_precise = false
        AND date_debut < date_trunc('month', CURRENT_DATE)`,
  },

  // ---- Candidatures aux élections ----
  //
  // Ces cinq invariants valent zéro tant qu'aucune candidature n'est ingérée :
  // ils comptent des violations, pas des lignes. Ils ne bloquent donc rien
  // avant la publication du fichier du ministère.
  //
  // Trois d'entre eux traduisent le code électoral lui-même, et c'est ce qui
  // en fait de bons contrôles : ils ne dépendent d'aucun seuil arbitraire, et
  // les vérifier sur l'édition 2023 les a tous donnés à zéro.
  candidatures_sans_nom: {
    type: 'invariant',
    label: 'Candidatures sans nom',
    min: 0,
    max: 0,
    // Garde-fou contre les lignes fantômes : la feuille du scrutin majoritaire
    // 2023 se terminait par sept lignes réduites à une cellule vide.
    query: `SELECT COUNT(*)::int AS value FROM candidatures WHERE btrim(nom) = ''`,
  },
  candidatures_taille_liste: {
    type: 'invariant',
    label: 'Circonscriptions aux listes de tailles inégales (art. L. 300)',
    min: 0,
    max: 0,
    // Toutes les listes d'une même circonscription comptent le même nombre de
    // candidats — le nombre de sièges plus deux. Une taille qui diverge veut
    // dire qu'une liste a été tronquée à la lecture, ou dédoublée par une clef
    // de regroupement trop faible.
    query: `SELECT COUNT(*)::int AS value FROM (
      SELECT scrutin, circonscription_id
      FROM (
        SELECT l.scrutin, l.circonscription_id, l.id, COUNT(c.id) AS taille
        FROM candidatures_listes l
        JOIN candidatures c ON c.liste_id = l.id
        WHERE l.mode_scrutin = 'proportionnel'
        GROUP BY l.scrutin, l.circonscription_id, l.id
      ) tailles
      GROUP BY scrutin, circonscription_id
      HAVING COUNT(DISTINCT taille) > 1
    ) sub`,
  },
  candidatures_alternance: {
    type: 'invariant',
    label: 'Ruptures d\'alternance femme-homme sur les listes (art. L. 300)',
    min: 0,
    max: 0,
    // Les listes sont composées alternativement d'un candidat de chaque sexe.
    // Deux candidats consécutifs de même sexe signalent un ordre de liste mal
    // lu — donc un classement faux, et des « suivants de liste » erronés au
    // moment de l'attribution des sièges.
    query: `SELECT COUNT(*)::int AS value FROM (
      SELECT c.sexe, LAG(c.sexe) OVER (PARTITION BY c.liste_id ORDER BY c.ordre) AS precedent
      FROM candidatures c
      JOIN candidatures_listes l ON l.id = c.liste_id
      WHERE l.mode_scrutin = 'proportionnel' AND c.role = 'titulaire'
    ) sub WHERE precedent IS NOT NULL AND sexe = precedent`,
  },
  candidatures_suppleant_meme_sexe: {
    type: 'invariant',
    label: 'Binômes titulaire-suppléant de même sexe (art. L. 299)',
    min: 0,
    max: 0,
    // Au scrutin majoritaire, le suppléant est de sexe opposé au titulaire.
    // L'égalité signale des colonnes de suppléant décalées.
    query: `SELECT COUNT(*)::int AS value FROM candidatures t
      JOIN candidatures s ON s.liste_id = t.liste_id AND s.role = 'suppleant'
      WHERE t.role = 'titulaire'
        AND t.sexe IS NOT NULL AND s.sexe IS NOT NULL
        AND t.sexe = s.sexe`,
  },
  candidatures_sortants_non_rattaches: {
    type: 'invariant',
    label: 'Sortants déclarés par le fichier mais non rattachés à une personne',
    min: 0,
    max: 0,
    // Le fichier désigne lui-même les sortants, et un sortant est par
    // définition dans notre corpus. Un écart mesure donc la casse du
    // rapprochement, jamais une réalité politique. Mesuré à 119 sur 119 sur
    // l'édition 2023.
    query: `SELECT COUNT(*)::int AS value FROM candidatures
      WHERE sortant_declare = true AND personne_id IS NULL`,
  },

  // ---- Seuils quantitatifs (minimums) ----
  parlementaires_count: {
    type: 'threshold',
    label: 'Nombre de parlementaires',
    min: 900,
    query: `SELECT COUNT(*)::int AS value FROM parlementaires`,
  },
  groupes_count: {
    type: 'threshold',
    label: 'Nombre de groupes politiques',
    min: 15,
    query: `SELECT COUNT(*)::int AS value FROM groupes_politiques`,
  },
  scrutins_count: {
    type: 'threshold',
    label: 'Nombre de scrutins',
    min: 5000,
    query: `SELECT COUNT(*)::int AS value FROM scrutins`,
  },
  votes_count: {
    type: 'threshold',
    label: 'Nombre de votes',
    min: 1000000,
    query: `SELECT COUNT(*)::int AS value FROM votes`,
  },
  amendements_count: {
    type: 'threshold',
    label: "Nombre d'amendements",
    min: 150000,
    query: `SELECT COUNT(*)::int AS value FROM amendements`,
  },
  interventions_count: {
    type: 'threshold',
    // Relevé de 70 000 au passage des débats AN à syceron. Ramené de 600 000
    // à 500 000 quand on a cessé de compter des paragraphes de compte rendu
    // pour compter des tours de parole : recoller les propos que le chahut
    // coupait a retiré un cinquième des lignes sans retirer un mot de texte.
    // Test de fumée sur le volume brut — il compte donc aussi la mécanique de
    // séance et les interruptions.
    label: "Nombre d'interventions",
    min: 500000,
    query: `SELECT COUNT(*)::int AS value FROM interventions`,
  },
  debats_rattaches_par_scrutin: {
    type: 'threshold',
    // Le rattachement grossier — une intervention prend le scrutin de sa
    // journée quand il n'y en a qu'un — ne couvrait que 120 journées sur
    // 1 115 : partout ailleurs la page d'un scrutin montrait le débat du jour
    // entier, et trois scrutins du même jour affichaient les mêmes
    // interventions. Ce seuil garde la trace du rattachement fin, celui qui
    // lit les mises aux voix du compte rendu.
    //
    // 144 546 liens aujourd'hui, pour 12 292 mises aux voix rapprochées d'un
    // scrutin sur 12 471. Le compte a bondi quand le relevé des mises aux voix
    // a cessé de dépendre du seul code de grammaire : les votes sur l'ensemble
    // d'un texte et les motions y sont entrés.
    //
    // La chambre est filtrée depuis que le Sénat écrit dans la même table :
    // sans cela le compte mêlait les deux, et l'effondrement du rattachement
    // d'une chambre pouvait être masqué par le volume de l'autre.
    label: 'Liens débat-scrutin (Assemblée)',
    min: 130000,
    query: `SELECT COUNT(*)::int AS value
            FROM intervention_scrutin isc
            JOIN scrutins s ON s.id = isc.scrutin_id
            WHERE s.chambre = 'assemblee'`,
  },
  scrutins_avec_debat_an: {
    type: 'threshold',
    // Le seuil précédent compte des lignes ; celui-ci compte ce que le lecteur
    // constate — le nombre de votes dont la page montre le débat qui les a
    // précédés. Un rattachement qui se replierait sur quelques gros scrutins
    // garderait le volume de liens sans que la couverture suive : il faut donc
    // les deux.
    //
    // 12 265 scrutins sur 12 539, soit 98 % de la 17e et 96 % de la 16e.
    label: 'Scrutins de l\'Assemblée dont on montre le débat',
    min: 11500,
    query: `SELECT COUNT(DISTINCT isc.scrutin_id)::int AS value
            FROM intervention_scrutin isc
            JOIN scrutins s ON s.id = isc.scrutin_id
            WHERE s.chambre = 'assemblee'`,
  },
  scrutins_avec_debat_senat: {
    type: 'threshold',
    // Le Sénat se rattache par le sujet examiné et non par les chiffres
    // proclamés, que son compte rendu ne publie pas : le libellé du scrutin
    // d'un côté, la section de discussion de l'autre, bornées au même texte.
    //
    // Le périmètre atteignable est celui de nos comptes rendus, du 16/01/2024
    // au 21/07/2026 : 812 scrutins sur les 4 775 du Sénat, le reste précédant
    // le corpus. 759 d'entre eux ont un débat effectif — 43 autres ont bien
    // trouvé leur section, mais l'article y a été voté sans discussion.
    //
    // Le plancher est volontairement bas devant les 759 constatés : il garde
    // contre une panne franche du rattachement, pas contre la variation de
    // quelques scrutins au fil des séances nouvelles.
    label: 'Scrutins du Sénat dont on montre le débat',
    min: 700,
    query: `SELECT COUNT(DISTINCT isc.scrutin_id)::int AS value
            FROM intervention_scrutin isc
            JOIN scrutins s ON s.id = isc.scrutin_id
            WHERE s.chambre = 'senat'`,
  },
  interventions_explication_vote_an: {
    type: 'threshold',
    // L'Assemblée ne code pas ses explications de vote : `EXPL_VOTE`
    // n'apparaît que 7 fois sur les 601 séances de la 17e législature, et les
    // orateurs qui s'y succèdent portent un code générique. On ne les tenait
    // donc que par l'annonce faite au perchoir — et tant qu'on ne la lisait
    // pas, le corpus n'en comptait que 7 au lieu de 2 220, sans que rien ne le
    // signale. Ce seuil est là pour que la panne se voie si la lecture de
    // cette annonce cesse de fonctionner.
    label: "Explications de vote de l'Assemblée",
    min: 1800,
    query: `SELECT COUNT(*)::int AS value FROM interventions
            WHERE chambre = 'assemblee' AND type = 'explication_vote'`,
  },
  interventions_amendement_an: {
    type: 'threshold',
    // Même logique : le numéro d'amendement se lit sur l'attribut `adt` du
    // paragraphe. Il avait d'abord été cherché sur `valeur`, qui porte tout
    // autre chose : le champ est resté vide sur 276 137 lignes et faux sur les
    // 4 autres, pendant des semaines, sans qu'aucun contrôle ne s'en émeuve.
    label: "Interventions rattachées à un amendement (Assemblée)",
    min: 40000,
    query: `SELECT COUNT(*)::int AS value FROM interventions
            WHERE chambre = 'assemblee' AND cardinality(amendements_vises) > 0`,
  },
  lobbyistes_count: {
    type: 'threshold',
    label: 'Nombre de lobbyistes',
    min: 3500,
    query: `SELECT COUNT(*)::int AS value FROM lobbyistes`,
  },
  actions_lobby_count: {
    type: 'threshold',
    label: 'Nombre d\'actions lobby',
    min: 400,
    query: `SELECT COUNT(*)::int AS value FROM actions_lobby`,
  },
  dossiers_count: {
    type: 'threshold',
    label: 'Nombre de dossiers législatifs',
    min: 6000,
    query: `SELECT COUNT(*)::int AS value FROM dossiers_legislatifs`,
  },
  amendement_scrutin_links: {
    type: 'threshold',
    label: 'Liens amendement-scrutin',
    min: 4000,
    query: `SELECT COUNT(*)::int AS value FROM "_AmendementToScrutin"`,
  },
  an_amendment_link_rate: {
    type: 'threshold',
    label: 'Taux de liaison scrutins-amendements AN (%)',
    min: 80,
    query: `SELECT CASE WHEN total = 0 THEN 0 ELSE (linked * 100 / total)::int END AS value FROM (SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "_AmendementToScrutin" ast WHERE ast."B" = s.id)) AS linked FROM scrutins s WHERE s.chambre = 'assemblee' AND s.legislature = ${LEGISLATURE_AN_COURANTE} AND s.titre ILIKE '%amendement%') sub`,
  },
  senat_amendment_link_rate: {
    type: 'threshold',
    label: 'Taux de liaison scrutins-amendements Sénat (%)',
    min: 45,
    query: `SELECT CASE WHEN total = 0 THEN 0 ELSE (linked * 100 / total)::int END AS value FROM (SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "_AmendementToScrutin" ast WHERE ast."B" = s.id)) AS linked FROM scrutins s WHERE s.chambre = 'senat' AND s.session >= '${SENAT_SESSION_AMENDEMENTS_MIN}' AND s.titre ILIKE '%amendement%') sub`,
  },
  scrutin_dossier_link_rate: {
    type: 'threshold',
    label: 'Taux de liaison scrutins-dossiers (%)',
    min: 90,
    query: `SELECT CASE WHEN total = 0 THEN 0 ELSE (linked * 100 / total)::int END AS value FROM (SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE s.dossier_id IS NOT NULL) AS linked FROM scrutins s WHERE ${SCRUTINS_PERIMETRE_LIE}) sub`,
  },
  amendement_dossier_link_rate: {
    type: 'threshold',
    label: 'Taux de liaison amendements-dossiers (%)',
    min: 40,
    query: `SELECT CASE WHEN total = 0 THEN 0 ELSE (linked * 100 / total)::int END AS value FROM (SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE dossier_id IS NOT NULL) AS linked FROM amendements) sub`,
  },

  // ---- Commissions & Agenda ----
  commissions_count: {
    type: 'threshold',
    label: 'Nombre de commissions et organes',
    min: 2900,
    query: `SELECT COUNT(*)::int AS value FROM commissions`,
  },
  commissions_an_count: {
    type: 'threshold',
    label: 'Commissions AN',
    min: 2800,
    query: `SELECT COUNT(*)::int AS value FROM commissions WHERE chambre = 'assemblee'`,
  },
  commissions_senat_count: {
    type: 'threshold',
    label: 'Commissions Sénat',
    min: 35,
    query: `SELECT COUNT(*)::int AS value FROM commissions WHERE chambre = 'senat'`,
  },
  reunions_count: {
    type: 'threshold',
    label: 'Nombre de réunions',
    min: 6000,
    query: `SELECT COUNT(*)::int AS value FROM reunions`,
  },
  reunions_commission_link_rate: {
    type: 'threshold',
    label: 'Taux de liaison réunions-commissions AN (%)',
    min: 85,
    query: `SELECT CASE WHEN total = 0 THEN 0 ELSE (linked * 100 / total)::int END AS value FROM (SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE commission_id IS NOT NULL) AS linked FROM reunions) sub`,
  },
};

// =============================================================================
// Multi-amendment integrity check
// =============================================================================

/**
 * Extrait les numéros d'amendements du titre d'un scrutin.
 * Ex: "sur les amendements identiques n° I-77 rectifié, ... n° I-444 rectifié bis"
 * → ["I-77", "I-444"]
 */
export function extractAmendmentNumbers(titre: string): string[] {
  const matches: string[] = [];
  const regex = /n°\s+([A-Za-z]*-?\d+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(titre)) !== null) {
    if (match[1]) matches.push(match[1]);
  }
  return matches;
}

/**
 * Normalise un numéro d'amendement en strippant le suffixe rectificatif.
 * Ex: "2816 (Rect)" → "2816", "10 (2ème Rect)" → "10", "I-77" → "I-77"
 */
export function normalizeNumero(numero: string): string {
  return numero.replace(/\s*\(.*\)$/, '');
}

/**
 * Vérifie que chaque scrutin portant sur plusieurs amendements (titre "amendements identiques")
 * est bien linké à EXACTEMENT les bons amendements — tous présents, aucun en trop.
 */
export async function runMultiAmendmentCheck(prisma: PrismaClient): Promise<MultiAmendmentReport> {
  // Récupère tous les scrutins "amendements identiques" avec leurs amendements linkés
  const rows: Array<{
    id: string;
    titre: string;
    chambre: string;
    linked_numeros: string[] | null;
  }> = await prisma.$queryRawUnsafe(`
    SELECT s.id, s.titre, s.chambre,
           array_agg(a.numero ORDER BY a.numero) FILTER (WHERE a.numero IS NOT NULL) AS linked_numeros
    FROM scrutins s
    LEFT JOIN "_AmendementToScrutin" ast ON ast."B" = s.id
    LEFT JOIN amendements a ON a.id = ast."A"
    WHERE s.titre ILIKE '%amendements identiques%'
      AND ${SCRUTINS_PERIMETRE_AMENDEMENTS}
    GROUP BY s.id, s.titre, s.chambre
  `);

  const mismatches: MultiAmendmentMismatch[] = [];
  let correct = 0;
  let skipped = 0;

  for (const row of rows) {
    const expectedNumeros = extractAmendmentNumbers(row.titre).sort();

    // Ignore les scrutins avec un seul n° explicite (pattern AN "n° X et les amendements identiques suivants")
    if (expectedNumeros.length < 2) {
      skipped++;
      continue;
    }

    // Normalise les numeros DB: "2816 (Rect)" → "2816"
    const linkedNumerosRaw = row.linked_numeros ?? [];
    const linkedNumeros = linkedNumerosRaw.map(normalizeNumero).sort();

    const expectedSet = new Set(expectedNumeros);
    const linkedSet = new Set(linkedNumeros);

    const missingNumeros = expectedNumeros.filter((n) => !linkedSet.has(n));
    const extraNumeros = linkedNumeros.filter((n) => !expectedSet.has(n));

    if (missingNumeros.length === 0 && extraNumeros.length === 0) {
      correct++;
    } else {
      mismatches.push({
        scrutinId: row.id,
        chambre: row.chambre,
        expectedNumeros,
        linkedNumeros: linkedNumerosRaw, // raw pour le rapport
        missingNumeros,
        extraNumeros,
      });
    }
  }

  const checked = rows.length - skipped;

  // Stats par chambre
  const byChambre: Record<string, MultiAmendmentChambreStats> = {};
  for (const row of rows) {
    const nums = extractAmendmentNumbers(row.titre);
    if (nums.length < 2) continue;
    const stats = byChambre[row.chambre] ?? { total: 0, correct: 0, incorrect: 0 };
    stats.total++;
    byChambre[row.chambre] = stats;
  }
  for (const m of mismatches) {
    const stats = byChambre[m.chambre];
    if (stats) stats.incorrect++;
  }
  for (const stats of Object.values(byChambre)) {
    stats.correct = stats.total - stats.incorrect;
  }

  return {
    total: checked,
    correct,
    incorrect: mismatches.length,
    byChambre,
    mismatches,
  };
}

// =============================================================================
// Liens sortants Sujets — rapport informatif (non bloquant)
//
// La couverture est volontairement partielle (Wikipédia haute précision,
// construction dépendante des actesLegislatifs disponibles) et la table peut
// être absente avant la migration : ce check est donc informatif, table-guardé,
// et ne participe pas au pass/fail.
// =============================================================================

const SUJET_LIENS_SAMPLE_SIZE = 10;
const DEAD_LINK_TIMEOUT_MS = 5000;

export async function runSujetLiensCheck(
  prisma: PrismaClient,
  opts: { checkDeadLinks?: boolean } = {},
): Promise<SujetLiensReport> {
  const empty: SujetLiensReport = {
    available: false,
    sujetsTotal: 0,
    construction: { totalLinks: 0, sujetsCovered: 0, coverageRate: 0 },
    contexte: { totalLinks: 0, sujetsCovered: 0, coverageRate: 0 },
    deadLinks: null,
  };

  // Table absente (migration non appliquée) → rapport "non disponible".
  const existsRows: Array<{ exists: boolean }> = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sujet_liens') AS exists`,
  );
  if (!existsRows[0]?.exists) return empty;

  const aggRows: Array<{
    sujets_total: number;
    c_links: number;
    c_sujets: number;
    x_links: number;
    x_sujets: number;
  }> = await prisma.$queryRawUnsafe(`
    SELECT
      (SELECT COUNT(*) FROM sujets WHERE actif = true)::int AS sujets_total,
      (SELECT COUNT(*) FROM sujet_liens WHERE famille = 'construction')::int AS c_links,
      (SELECT COUNT(DISTINCT sujet_id) FROM sujet_liens WHERE famille = 'construction')::int AS c_sujets,
      (SELECT COUNT(*) FROM sujet_liens WHERE famille = 'contexte')::int AS x_links,
      (SELECT COUNT(DISTINCT sujet_id) FROM sujet_liens WHERE famille = 'contexte')::int AS x_sujets
  `);

  const agg = aggRows[0];
  const sujetsTotal = Number(agg?.sujets_total ?? 0);
  const rate = (covered: number) =>
    sujetsTotal > 0 ? Math.round((covered / sujetsTotal) * 100) : 0;

  // Échantillon de liens non-morts (best-effort, jamais bloquant).
  // Une erreur réseau (timeout, offline) compte comme "non vérifié", pas "mort" :
  // seuls les statuts HTTP >= 400 sont considérés comme morts.
  let deadLinks: SujetLiensDeadLinkSample | null = null;
  if (opts.checkDeadLinks) {
    const sample: Array<{ url: string }> = await prisma.$queryRawUnsafe(
      `SELECT url FROM sujet_liens ORDER BY random() LIMIT ${SUJET_LIENS_SAMPLE_SIZE}`,
    );
    let checked = 0;
    let dead = 0;
    const deadUrls: string[] = [];

    await Promise.all(
      sample.map(async ({ url }) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), DEAD_LINK_TIMEOUT_MS);
        try {
          const res = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            redirect: 'follow',
          });
          checked++;
          if (res.status >= 400) {
            dead++;
            deadUrls.push(url);
          }
        } catch {
          // réseau indisponible → non vérifié
        } finally {
          clearTimeout(timer);
        }
      }),
    );

    deadLinks = { sampled: sample.length, checked, dead, deadUrls };
  }

  return {
    available: true,
    sujetsTotal,
    construction: {
      totalLinks: Number(agg?.c_links ?? 0),
      sujetsCovered: Number(agg?.c_sujets ?? 0),
      coverageRate: rate(Number(agg?.c_sujets ?? 0)),
    },
    contexte: {
      totalLinks: Number(agg?.x_links ?? 0),
      sujetsCovered: Number(agg?.x_sujets ?? 0),
      coverageRate: rate(Number(agg?.x_sujets ?? 0)),
    },
    deadLinks,
  };
}

// =============================================================================
// Runner
// =============================================================================

export async function runDataQualityChecks(
  prisma: PrismaClient,
  opts: { checkSujetLinksHttp?: boolean } = {},
): Promise<QualityReport> {
  const start = Date.now();
  const results: CheckResult[] = [];

  for (const [key, config] of Object.entries(THRESHOLDS)) {
    const rows: Array<{ value: number }> = await prisma.$queryRawUnsafe(config.query);
    const actual = Number(rows[0]?.value ?? 0);

    let passed: boolean;
    let expected: string;

    if (config.type === 'invariant') {
      passed = actual === 0;
      expected = '= 0';
    } else {
      passed = actual >= config.min;
      expected = `>= ${config.min.toLocaleString('fr-FR')}`;
    }

    results.push({
      key,
      label: config.label,
      type: config.type,
      expected,
      actual,
      passed,
    });
  }

  const multiAmendment = await runMultiAmendmentCheck(prisma);
  const sujetLiens = await runSujetLiensCheck(prisma, {
    checkDeadLinks: opts.checkSujetLinksHttp ?? false,
  });

  const invariantResults = results.filter((r) => r.type === 'invariant');
  const thresholdResults = results.filter((r) => r.type === 'threshold');

  const duration = `${((Date.now() - start) / 1000).toFixed(1)}s`;

  return {
    results,
    multiAmendment,
    sujetLiens,
    passed: results.every((r) => r.passed),
    invariantsPassed: invariantResults.every((r) => r.passed),
    thresholdsPassed: thresholdResults.every((r) => r.passed),
    duration,
  };
}

// =============================================================================
// Report printer
// =============================================================================

export function printReport(report: QualityReport): void {
  console.log('\n========================================');
  console.log('  DATA QUALITY REPORT');
  console.log('========================================\n');

  // Invariants
  const invariants = report.results.filter((r) => r.type === 'invariant');
  if (invariants.length > 0) {
    console.log('--- Invariants (zero tolérance) ---\n');
    for (const r of invariants) {
      const icon = r.passed ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
      const actualStr = r.passed
        ? `${r.actual}`
        : `\x1b[31m${r.actual}\x1b[0m`;
      console.log(`  ${icon}  ${r.label.padEnd(42)} ${r.expected.padEnd(12)} actual: ${actualStr}`);
    }
    console.log();
  }

  // Thresholds
  const thresholds = report.results.filter((r) => r.type === 'threshold');
  if (thresholds.length > 0) {
    console.log('--- Seuils quantitatifs ---\n');
    for (const r of thresholds) {
      const icon = r.passed ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
      const actualStr = r.passed
        ? r.actual.toLocaleString('fr-FR')
        : `\x1b[31m${r.actual.toLocaleString('fr-FR')}\x1b[0m`;
      console.log(`  ${icon}  ${r.label.padEnd(42)} ${r.expected.padEnd(16)} actual: ${actualStr}`);
    }
    console.log();
  }

  // Multi-amendment integrity (informatif — ne bloque pas le pass/fail)
  const ma = report.multiAmendment;
  console.log('--- Intégrité multi-amendements (informatif) ---\n');
  const maRate = ma.total > 0 ? Math.round((ma.correct / ma.total) * 100) : 100;
  const maIcon = ma.incorrect === 0 ? '\x1b[32m✓\x1b[0m' : '\x1b[33m⚠\x1b[0m';
  console.log(`  ${maIcon}  Global: ${ma.correct}/${ma.total} corrects (${maRate}%)`);

  for (const [chambre, stats] of Object.entries(ma.byChambre)) {
    const rate = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 100;
    const icon = stats.incorrect === 0 ? '\x1b[32m✓\x1b[0m' : '\x1b[33m⚠\x1b[0m';
    console.log(`  ${icon}  ${chambre.padEnd(12)} ${stats.correct}/${stats.total} (${rate}%)`);
  }

  if (ma.mismatches.length > 0) {
    console.log();
    const limit = Math.min(ma.mismatches.length, 5);
    for (const m of ma.mismatches.slice(0, limit)) {
      console.log(`    \x1b[33m⚠\x1b[0m  [${m.chambre}] scrutin ${m.scrutinId.slice(0, 8)}...`);
      if (m.missingNumeros.length > 0) {
        console.log(`       Manquants: ${m.missingNumeros.join(', ')}`);
      }
      if (m.extraNumeros.length > 0) {
        console.log(`       En trop:   ${m.extraNumeros.join(', ')}`);
      }
    }
    if (ma.mismatches.length > limit) {
      console.log(`    ... et ${ma.mismatches.length - limit} autres`);
    }
  }
  console.log();

  // Liens sortants Sujets (informatif — ne bloque pas le pass/fail)
  const sl = report.sujetLiens;
  console.log('--- Liens sortants Sujets (informatif) ---\n');
  if (!sl.available) {
    console.log('  \x1b[33m⚠\x1b[0m  Table sujet_liens absente (migration non appliquée)\n');
  } else {
    const fam = (label: string, s: SujetLiensFamilleStats) => {
      const icon = s.totalLinks > 0 ? '\x1b[32m✓\x1b[0m' : '\x1b[33m⚠\x1b[0m';
      console.log(
        `  ${icon}  ${label.padEnd(28)} ${String(s.totalLinks).padStart(5)} liens · ` +
          `${s.sujetsCovered}/${sl.sujetsTotal} sujets (${s.coverageRate}%)`,
      );
    };
    fam('Documents officiels', sl.construction);
    fam('Pour aller plus loin (contexte)', sl.contexte);

    if (sl.deadLinks) {
      const d = sl.deadLinks;
      const icon = d.dead === 0 ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
      console.log(
        `  ${icon}  ${'Échantillon liens HTTP'.padEnd(28)} ${d.dead} mort(s) sur ${d.checked} vérifié(s) (échantillon ${d.sampled})`,
      );
      for (const url of d.deadUrls.slice(0, 5)) {
        console.log(`       \x1b[31m✗\x1b[0m ${url}`);
      }
    }
    console.log();
  }

  // Summary
  console.log('========================================');
  const totalPassed = report.results.filter((r) => r.passed).length;
  const total = report.results.length;

  if (report.passed) {
    console.log(`  \x1b[32m✓ PASSED\x1b[0m  ${totalPassed}/${total} checks  (${report.duration})`);
  } else {
    const failedChecks = report.results.filter((r) => !r.passed);
    console.log(`  \x1b[31m✗ FAILED\x1b[0m  ${totalPassed}/${total} checks  (${report.duration})`);
    console.log(`  Échecs: ${failedChecks.map((r) => r.key).join(', ')}`);
  }
  console.log('========================================\n');
}
