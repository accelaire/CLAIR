-- Index de la base LEGI de la DILA (T5, ticket #46) : deux tables d'identifiants
-- et de dates, sans contenu juridique, pour pointer les références des
-- amendements vers Légifrance. Remplies ensuite par `sync-index-legi`, pas par
-- cette migration : elle ne crée que des tables vides, sans verrou sur
-- l'existant.
--
-- Les triggers d'horodatage sont ceux de `prisma/triggers.sql`, copiés ici
-- (une migration ne doit pas dépendre d'un fichier qui évolue).

-- CreateTable
CREATE TABLE "legi_textes" (
    "id" TEXT NOT NULL,
    "cid" TEXT NOT NULL,
    "nature" TEXT NOT NULL,
    "num" TEXT,
    "date_texte" DATE,
    "date_debut" DATE,
    "date_fin" DATE,
    "etat" TEXT,
    "titre" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legi_textes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legi_articles" (
    "id" TEXT NOT NULL,
    "cid" TEXT NOT NULL,
    "num" TEXT,
    "etat" TEXT,
    "date_debut" DATE,
    "date_fin" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legi_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legi_textes_cid_idx" ON "legi_textes"("cid");

-- CreateIndex
CREATE INDEX "legi_articles_cid_num_idx" ON "legi_articles"("cid", "num");

-- Horodatage
CREATE OR REPLACE TRIGGER legi_textes_updated_at BEFORE INSERT OR UPDATE ON legi_textes
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
CREATE OR REPLACE TRIGGER legi_articles_updated_at BEFORE INSERT OR UPDATE ON legi_articles
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
