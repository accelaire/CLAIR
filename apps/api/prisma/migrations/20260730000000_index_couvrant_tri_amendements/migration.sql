-- Index couvrant pour le tri de la liste d'amendements d'un parlementaire.
--
-- La liste sélectionne d'abord les candidats (auteur UNION cosignataires), puis
-- les ordonne par date de dépôt pour n'en garder que 20. Pour un député très
-- cosignataire (18 753 amendements), trier exigeait de lire la LIGNE COMPLÈTE de
-- chacun via `amendements_pkey` — 18 753 accès aléatoires dans une table de
-- 408 Mo, alors que seules 3 colonnes de tri étaient nécessaires.
--
-- Mesuré en prod : 84 276 buffers, soit 658 Mo de trafic pour renvoyer 20
-- lignes ; 17,9 s au premier appel contre 178 ms une fois les pages en cache
-- (`shared_buffers` = 128 Mo, la table n'y tient pas).
--
-- En embarquant les colonnes de tri dans l'index, le plan passe à `Heap
-- Fetches: 0` : la table n'est plus jamais touchée, seul un index de ~22 Mo est
-- parcouru. `sort` y figure aussi pour couvrir le filtre du même nom.
--
-- Le planificateur choisit seul entre Nested Loop (petits volumes, ~4 ms) et
-- Hash Join (gros volumes) — vérifié sur 239, 718 et 17 894 cosignatures.
CREATE INDEX IF NOT EXISTS "amendements_id_tri_idx"
  ON "amendements" ("id")
  INCLUDE ("date_depot", "dossier_id", "numero_ordre", "sort");
