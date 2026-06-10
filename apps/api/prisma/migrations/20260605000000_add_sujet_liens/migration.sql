-- CreateTable
CREATE TABLE "sujet_liens" (
    "id" TEXT NOT NULL,
    "sujet_id" TEXT NOT NULL,
    "famille" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_label" TEXT,
    "date_publication" TIMESTAMP(3),
    "provenance" TEXT NOT NULL DEFAULT 'auto',
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sujet_liens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sujet_liens_sujet_id_famille_ordre_idx" ON "sujet_liens"("sujet_id", "famille", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "sujet_liens_sujet_id_url_key" ON "sujet_liens"("sujet_id", "url");

-- AddForeignKey
ALTER TABLE "sujet_liens" ADD CONSTRAINT "sujet_liens_sujet_id_fkey" FOREIGN KEY ("sujet_id") REFERENCES "sujets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
