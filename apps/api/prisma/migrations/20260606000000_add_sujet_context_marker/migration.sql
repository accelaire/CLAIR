-- Marqueur de résolution incrémentale des liens "contexte" des sujets.
-- Évite de ré-interroger Tavily/Wikipédia pour tous les sujets à chaque sync :
-- on ne re-résout que si le hash d'entrée (label|status) change, si jamais résolu,
-- ou si le sujet est sans lien depuis longtemps (retry du long-tail).
ALTER TABLE "sujets" ADD COLUMN "context_resolved_at" TIMESTAMP(3);
ALTER TABLE "sujets" ADD COLUMN "context_input_hash" TEXT;
