-- Texte des articles des textes législatifs.
--
-- Le contenu des articles n'était stocké nulle part : un scrutin portant sur
-- « l'article 15 » n'avait pour toute matière que son propre titre, ce qui
-- suffisait au modèle pour en inventer le contenu.
--
-- Clé fonctionnelle (texte_ref, numero) : un article n'existe que dans une
-- version donnée d'un texte, et c'est le couple que porte déjà `amendements`.

CREATE TABLE "textes_articles" (
    "id" TEXT NOT NULL,
    "texte_ref" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "contenu" TEXT NOT NULL,
    "chambre" TEXT NOT NULL DEFAULT 'assemblee',
    "legislature" INTEGER NOT NULL,
    "dossier_id" TEXT,
    "source_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "textes_articles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "textes_articles_texte_ref_numero_key" ON "textes_articles"("texte_ref", "numero");
CREATE INDEX "textes_articles_texte_ref_idx" ON "textes_articles"("texte_ref");
CREATE INDEX "textes_articles_dossier_id_idx" ON "textes_articles"("dossier_id");
CREATE INDEX "textes_articles_chambre_legislature_idx" ON "textes_articles"("chambre", "legislature");

ALTER TABLE "textes_articles" ADD CONSTRAINT "textes_articles_dossier_id_fkey"
    FOREIGN KEY ("dossier_id") REFERENCES "dossiers_legislatifs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
