-- CreateTable
CREATE TABLE "deputes" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "sexe" TEXT,
    "date_naissance" TIMESTAMP(3),
    "lieu_naissance" TEXT,
    "profession" TEXT,
    "photo_url" TEXT,
    "twitter" TEXT,
    "email" TEXT,
    "site_web" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "groupe_id" TEXT,
    "circonscription_id" TEXT,
    "source_id" TEXT,
    "source_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groupes_politiques" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "nom_complet" TEXT,
    "couleur" TEXT,
    "position" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "source_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groupes_politiques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "circonscriptions" (
    "id" TEXT NOT NULL,
    "departement" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "population" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "circonscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrutins" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "titre" TEXT NOT NULL,
    "type_vote" TEXT NOT NULL,
    "sort" TEXT NOT NULL,
    "nombre_votants" INTEGER NOT NULL,
    "nombre_pour" INTEGER NOT NULL,
    "nombre_contre" INTEGER NOT NULL,
    "nombre_abstention" INTEGER NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "importance" INTEGER NOT NULL DEFAULT 1,
    "texte_id" TEXT,
    "texte_numero" TEXT,
    "texte_titre" TEXT,
    "source_url" TEXT,
    "source_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scrutins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" TEXT NOT NULL,
    "depute_id" TEXT NOT NULL,
    "scrutin_id" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "mise_au_point" TEXT,
    "par_delegation" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interventions" (
    "id" TEXT NOT NULL,
    "depute_id" TEXT NOT NULL,
    "seance_id" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "mots_cles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interventions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amendements" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "depute_id" TEXT NOT NULL,
    "texte_id" TEXT,
    "article_vise" TEXT,
    "objet" TEXT,
    "dispositif" TEXT,
    "sort" TEXT NOT NULL,
    "date_depot" TIMESTAMP(3) NOT NULL,
    "date_sort" TIMESTAMP(3),
    "source_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amendements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lobbyistes" (
    "id" TEXT NOT NULL,
    "siren" TEXT,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "secteur" TEXT,
    "adresse" TEXT,
    "code_postal" TEXT,
    "ville" TEXT,
    "budget_annuel" DOUBLE PRECISION,
    "nb_lobbyistes" INTEGER,
    "site_web" TEXT,
    "source_id" TEXT,
    "source_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lobbyistes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actions_lobby" (
    "id" TEXT NOT NULL,
    "lobbyiste_id" TEXT NOT NULL,
    "depute_id" TEXT,
    "cible" TEXT,
    "cible_nom" TEXT,
    "description" TEXT NOT NULL,
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3),
    "budget" DOUBLE PRECISION,
    "resultat" TEXT,
    "texte_vise" TEXT,
    "texte_vise_nom" TEXT,
    "source_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actions_lobby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promesses" (
    "id" TEXT NOT NULL,
    "depute_id" TEXT,
    "parti_id" TEXT,
    "texte" TEXT NOT NULL,
    "source_url" TEXT,
    "date_promesse" TIMESTAMP(3),
    "categorie" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'non_evaluee',
    "scrutins_lies" TEXT[],
    "evaluation" TEXT,
    "evaluation_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "nom" TEXT,
    "prenom" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "google_id" TEXT,
    "apple_id" TEXT,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cible_type" TEXT NOT NULL,
    "cible_id" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favoris" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cible_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favoris_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contenus" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "data" JSONB NOT NULL,
    "fichier_url" TEXT,
    "thumbnail_url" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'draft',
    "vues" INTEGER NOT NULL DEFAULT 0,
    "partages" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "depute_id" TEXT,
    "scrutin_id" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contenus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "items_processed" INTEGER NOT NULL DEFAULT 0,
    "items_created" INTEGER NOT NULL DEFAULT 0,
    "items_updated" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deputes_slug_key" ON "deputes"("slug");

-- CreateIndex
CREATE INDEX "deputes_slug_idx" ON "deputes"("slug");

-- CreateIndex
CREATE INDEX "deputes_groupe_id_idx" ON "deputes"("groupe_id");

-- CreateIndex
CREATE INDEX "deputes_actif_idx" ON "deputes"("actif");

-- CreateIndex
CREATE INDEX "deputes_nom_prenom_idx" ON "deputes"("nom", "prenom");

-- CreateIndex
CREATE UNIQUE INDEX "groupes_politiques_slug_key" ON "groupes_politiques"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "circonscriptions_departement_numero_key" ON "circonscriptions"("departement", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "scrutins_numero_key" ON "scrutins"("numero");

-- CreateIndex
CREATE INDEX "scrutins_date_idx" ON "scrutins"("date");

-- CreateIndex
CREATE INDEX "scrutins_type_vote_idx" ON "scrutins"("type_vote");

-- CreateIndex
CREATE INDEX "scrutins_tags_idx" ON "scrutins"("tags");

-- CreateIndex
CREATE INDEX "scrutins_importance_idx" ON "scrutins"("importance");

-- CreateIndex
CREATE INDEX "votes_scrutin_id_idx" ON "votes"("scrutin_id");

-- CreateIndex
CREATE INDEX "votes_position_idx" ON "votes"("position");

-- CreateIndex
CREATE UNIQUE INDEX "votes_depute_id_scrutin_id_key" ON "votes"("depute_id", "scrutin_id");

-- CreateIndex
CREATE INDEX "interventions_depute_id_idx" ON "interventions"("depute_id");

-- CreateIndex
CREATE INDEX "interventions_date_idx" ON "interventions"("date");

-- CreateIndex
CREATE INDEX "interventions_type_idx" ON "interventions"("type");

-- CreateIndex
CREATE INDEX "amendements_depute_id_idx" ON "amendements"("depute_id");

-- CreateIndex
CREATE INDEX "amendements_sort_idx" ON "amendements"("sort");

-- CreateIndex
CREATE INDEX "amendements_date_depot_idx" ON "amendements"("date_depot");

-- CreateIndex
CREATE UNIQUE INDEX "lobbyistes_siren_key" ON "lobbyistes"("siren");

-- CreateIndex
CREATE INDEX "lobbyistes_secteur_idx" ON "lobbyistes"("secteur");

-- CreateIndex
CREATE INDEX "lobbyistes_type_idx" ON "lobbyistes"("type");

-- CreateIndex
CREATE INDEX "lobbyistes_nom_idx" ON "lobbyistes"("nom");

-- CreateIndex
CREATE INDEX "actions_lobby_lobbyiste_id_idx" ON "actions_lobby"("lobbyiste_id");

-- CreateIndex
CREATE INDEX "actions_lobby_depute_id_idx" ON "actions_lobby"("depute_id");

-- CreateIndex
CREATE INDEX "actions_lobby_date_debut_idx" ON "actions_lobby"("date_debut");

-- CreateIndex
CREATE INDEX "promesses_depute_id_idx" ON "promesses"("depute_id");

-- CreateIndex
CREATE INDEX "promesses_statut_idx" ON "promesses"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_apple_id_key" ON "users"("apple_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "alertes_user_id_idx" ON "alertes"("user_id");

-- CreateIndex
CREATE INDEX "alertes_actif_idx" ON "alertes"("actif");

-- CreateIndex
CREATE UNIQUE INDEX "favoris_user_id_type_cible_id_key" ON "favoris"("user_id", "type", "cible_id");

-- CreateIndex
CREATE INDEX "contenus_type_idx" ON "contenus"("type");

-- CreateIndex
CREATE INDEX "contenus_statut_idx" ON "contenus"("statut");

-- CreateIndex
CREATE INDEX "contenus_published_at_idx" ON "contenus"("published_at");

-- CreateIndex
CREATE INDEX "sync_logs_source_idx" ON "sync_logs"("source");

-- CreateIndex
CREATE INDEX "sync_logs_started_at_idx" ON "sync_logs"("started_at");

-- AddForeignKey
ALTER TABLE "deputes" ADD CONSTRAINT "deputes_groupe_id_fkey" FOREIGN KEY ("groupe_id") REFERENCES "groupes_politiques"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deputes" ADD CONSTRAINT "deputes_circonscription_id_fkey" FOREIGN KEY ("circonscription_id") REFERENCES "circonscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_depute_id_fkey" FOREIGN KEY ("depute_id") REFERENCES "deputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_scrutin_id_fkey" FOREIGN KEY ("scrutin_id") REFERENCES "scrutins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_depute_id_fkey" FOREIGN KEY ("depute_id") REFERENCES "deputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amendements" ADD CONSTRAINT "amendements_depute_id_fkey" FOREIGN KEY ("depute_id") REFERENCES "deputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions_lobby" ADD CONSTRAINT "actions_lobby_lobbyiste_id_fkey" FOREIGN KEY ("lobbyiste_id") REFERENCES "lobbyistes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions_lobby" ADD CONSTRAINT "actions_lobby_depute_id_fkey" FOREIGN KEY ("depute_id") REFERENCES "deputes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertes" ADD CONSTRAINT "alertes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favoris" ADD CONSTRAINT "favoris_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
