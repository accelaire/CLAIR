-- CreateTable
CREATE TABLE "feedbacks" (
    "id" TEXT NOT NULL,
    "sentiment" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "email" TEXT,
    "page" TEXT,
    "trigger" TEXT DEFAULT 'passif',
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedbacks_created_at_idx" ON "feedbacks"("created_at");

-- CreateIndex
CREATE INDEX "feedbacks_type_idx" ON "feedbacks"("type");
