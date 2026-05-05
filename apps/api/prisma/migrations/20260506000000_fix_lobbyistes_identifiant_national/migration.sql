-- DropColumn
ALTER TABLE "lobbyistes" DROP COLUMN IF EXISTS "source_id";

-- AddColumn
ALTER TABLE "lobbyistes" ADD COLUMN "identifiant_national" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "lobbyistes_identifiant_national_key" ON "lobbyistes"("identifiant_national");
