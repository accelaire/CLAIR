-- =============================================================================
-- Multi-législatures — Phase 1 : unique groupes_politiques par législature
-- Voir SPEC-MULTI-LEGISLATURES.md (ticket #13).
--
-- Un même sigle de groupe (ex. « RN ») existe sur plusieurs législatures AN avec
-- des uid d'organe distincts. L'unique [slug, chambre] empêchait de coexister →
-- on l'élargit à [slug, chambre, legislature].
--
-- SÛRETÉ : l'ancien unique [slug, chambre] garantit qu'aucune paire (slug, chambre)
-- n'est dupliquée → a fortiori aucune (slug, chambre, legislature). La création du
-- nouvel index ne peut donc pas échouer sur les données existantes.
--
-- Note Sénat : legislature est NULL pour le Sénat ; en SQL les NULL sont distincts
-- dans un index unique → la déduplication des groupes Sénat reste assurée au niveau
-- applicatif (match findFirst par sourceId/slug), comme aujourd'hui.
-- =============================================================================

-- DropIndex
DROP INDEX "groupes_politiques_slug_chambre_key";

-- CreateIndex
CREATE UNIQUE INDEX "groupes_politiques_slug_chambre_legislature_key" ON "groupes_politiques"("slug", "chambre", "legislature");
