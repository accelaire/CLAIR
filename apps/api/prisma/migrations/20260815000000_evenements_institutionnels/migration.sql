-- Événements institutionnels : repères du calendrier politique (élections,
-- bornes de session, suspensions de travaux, échéances budgétaires, temps forts).
-- Contenu curé à la main côté ingestion, poussé par upsert idempotent sur `slug`.
-- Additif pur : aucune table existante n'est touchée.

CREATE TABLE "evenements_institutionnels" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3),
    "date_precise" BOOLEAN NOT NULL DEFAULT true,
    "chambre" TEXT,
    -- Tableau [{ label, url? }] : un repère transverse cite plusieurs autorités.
    "sources" JSONB,
    "important" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evenements_institutionnels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "evenements_institutionnels_slug_key" ON "evenements_institutionnels"("slug");
CREATE INDEX "evenements_institutionnels_date_debut_idx" ON "evenements_institutionnels"("date_debut");
CREATE INDEX "evenements_institutionnels_type_idx" ON "evenements_institutionnels"("type");
CREATE INDEX "evenements_institutionnels_important_idx" ON "evenements_institutionnels"("important");
