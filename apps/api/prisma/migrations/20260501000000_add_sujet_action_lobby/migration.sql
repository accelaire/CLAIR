CREATE TABLE "sujet_action_lobby" (
    "sujet_id"        TEXT        NOT NULL,
    "action_lobby_id" TEXT        NOT NULL,
    "score"           DOUBLE PRECISION NOT NULL,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sujet_action_lobby_pkey" PRIMARY KEY ("sujet_id", "action_lobby_id")
);

CREATE INDEX "sujet_action_lobby_action_lobby_id_idx" ON "sujet_action_lobby"("action_lobby_id");

ALTER TABLE "sujet_action_lobby"
    ADD CONSTRAINT "sujet_action_lobby_sujet_id_fkey"
    FOREIGN KEY ("sujet_id") REFERENCES "sujets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sujet_action_lobby"
    ADD CONSTRAINT "sujet_action_lobby_action_lobby_id_fkey"
    FOREIGN KEY ("action_lobby_id") REFERENCES "actions_lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;
