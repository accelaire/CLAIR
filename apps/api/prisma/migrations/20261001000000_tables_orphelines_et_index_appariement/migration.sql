-- Ménage des objets créés en production hors du schéma.
--
-- Trois tables existaient en base sans figurer dans schema.prisma, et aucun
-- code ne les lisait ni ne les écrivait (vérifié le 01/10/2026 sur toutes les
-- branches et tous les worktrees) :
--   - `contenus` : vestige d'une ancienne fonctionnalité, 0 ligne ;
--   - `corpus_an` : table de transit chargée à la main le 10/09/2026 pendant
--     le rattachement des débats AN aux scrutins (445 773 lignes, 317 Mo), dont
--     les lignes sont depuis dans `interventions` ;
--   - `votes_cr` : mises aux voix relevées à la main le même jour pour mesurer
--     l'appariement avec les scrutins (11 253 lignes). Le code refait ce calcul
--     lui-même.
-- Aucune clé étrangère ni vue n'en dépend. IF EXISTS : une base qui ne les a
-- jamais eues (locale, CI) passe la migration sans erreur.

DROP TABLE IF EXISTS "contenus";
DROP TABLE IF EXISTS "corpus_an";
DROP TABLE IF EXISTS "votes_cr";

-- L'index d'appariement, lui, a été créé à la main le même jour et sert en
-- production (48 219 lectures au 01/10/2026). Il est désormais déclaré dans
-- schema.prisma ; IF NOT EXISTS le laisse intact en production, où il existe
-- déjà, et le crée sur les autres bases.
CREATE INDEX IF NOT EXISTS "scrutins_appariement" ON "scrutins"("seance_ref", "nombre_votants", "nombre_pour", "nombre_contre");
