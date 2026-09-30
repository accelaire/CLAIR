-- Identifiants qu'une personne garde dans la chambre qu'elle a quittée.
--
-- Un député élu sénateur voit sa fiche passer au Sénat avec son matricule ;
-- son identifiant de l'Assemblée (PA…) est conservé ici. Table additive.

-- CreateTable
CREATE TABLE "parlementaires_identifiants" (
    "id" TEXT NOT NULL,
    "personne_id" TEXT NOT NULL,
    "chambre" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parlementaires_identifiants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parlementaires_identifiants_chambre_source_id_key" ON "parlementaires_identifiants"("chambre", "source_id");

-- CreateIndex
CREATE INDEX "parlementaires_identifiants_personne_id_idx" ON "parlementaires_identifiants"("personne_id");

-- AddForeignKey
ALTER TABLE "parlementaires_identifiants" ADD CONSTRAINT "parlementaires_identifiants_personne_id_fkey" FOREIGN KEY ("personne_id") REFERENCES "parlementaires"("id") ON DELETE CASCADE ON UPDATE CASCADE;
