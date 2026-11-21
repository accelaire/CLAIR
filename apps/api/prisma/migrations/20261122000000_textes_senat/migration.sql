-- Textes du Sénat décrits par AMELI (`txt_ameli`) : session de dépôt, numéro et
-- signet du dossier DOSLEG. Ils permettent de rattacher chaque amendement du
-- Sénat au dossier de son texte, au lieu de le deviner par un scrutin ou un
-- voisin : un numéro de texte n'est unique que dans sa session de dépôt (le
-- n° 155 est le PLF 2014 en 2013-2014 et le PLF 2027 en 2026-2027).
--
-- Une création de table : le code déployé l'ignore, la migration peut passer en
-- production avant la fusion. La table reste vide jusqu'à la première nuit (ou
-- la commande `rattacher-amendements-senat`).
--
-- Le trigger d'horodatage est la copie de `prisma/triggers.sql` à la date de la
-- migration.

SET lock_timeout = '5s';

-- CreateTable
CREATE TABLE "textes_senat" (
    "texte_ref" TEXT NOT NULL,
    "session_depot" INTEGER NOT NULL,
    "session_inscription" INTEGER NOT NULL,
    "numero" TEXT NOT NULL,
    "signet" TEXT,
    "type" TEXT,
    "intitule" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "textes_senat_pkey" PRIMARY KEY ("texte_ref")
);

-- CreateIndex
CREATE INDEX "textes_senat_session_depot_numero_idx" ON "textes_senat"("session_depot", "numero");

-- Horodatage
CREATE OR REPLACE TRIGGER textes_senat_updated_at BEFORE INSERT OR UPDATE ON textes_senat
  FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at();
