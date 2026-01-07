# Guide de Déploiement CLAIR

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      VERCEL (Frontend)                           │
│  Next.js 14 - https://clair.vote                                │
│  Coût : 0€ (Hobby Plan)                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RAILWAY (Backend)                           │
│  Fastify API + PostgreSQL + Redis                               │
│  Coût estimé : 5-15€/mois                                       │
└─────────────────────────────────────────────────────────────────┘
```

## Domaine

- **Domaine** : `clair.vote` (Dynadot)
- **Frontend** : `clair.vote` → Vercel
- **API** : `api.clair.vote` → Railway

## Prérequis

- Compte GitHub (pour le déploiement automatique)
- Compte Vercel (gratuit)
- Compte Railway (gratuit pour commencer)
- Domaine `clair.vote` (Dynadot) ✅

---

## 1. Déploiement Frontend (Vercel)

### Étapes

1. Aller sur [vercel.com](https://vercel.com) et se connecter avec GitHub
2. Cliquer "New Project"
3. Importer le repo `accelaire/CLAIR`
4. Configurer :
   - **Framework Preset** : Next.js
   - **Root Directory** : `apps/web`
   - **Build Command** : `pnpm build`
   - **Install Command** : `pnpm install`

### Variables d'environnement Vercel

```
NEXT_PUBLIC_API_URL=https://api.clair.vote
NEXT_PUBLIC_HELLOASSO_ORG_SLUG=
NEXT_PUBLIC_HELLOASSO_FORM_SLUG=
```

### Configuration DNS (Dynadot)

1. Dans Vercel > Settings > Domains > Add `clair.vote`
2. Vercel donne les enregistrements DNS à configurer
3. Dans Dynadot > Manage Domain > DNS Settings :

```
Type    Name    Value
A       @       76.76.21.21
CNAME   www     cname.vercel-dns.com
```

---

## 2. Déploiement Backend (Railway)

### Étapes

1. Aller sur [railway.app](https://railway.app) et se connecter avec GitHub
2. Créer un nouveau projet
3. Ajouter les services :
   - **PostgreSQL** : "Add New" > "Database" > "PostgreSQL"
   - **Redis** : "Add New" > "Database" > "Redis"
   - **API** : "Add New" > "GitHub Repo" > `accelaire/CLAIR`

### Configuration de l'API

1. Dans les settings du service API :
   - **Root Directory** : `apps/api`
   - **Watch Paths** : `/apps/api/**`, `/packages/**`

### Variables d'environnement Railway

```
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Base de données (références Railway auto-remplies)
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# Sécurité
CORS_ORIGIN=https://clair.vote

# Sources de données
ASSEMBLEE_NATIONALE_BASE_URL=https://data.assemblee-nationale.fr
ASSEMBLEE_NATIONALE_LEGISLATURE=17
HATVP_BASE_URL=https://www.hatvp.fr
DILA_BASE_URL=https://echanges.dila.gouv.fr/OPENDATA/Debats/AN

# Logs
LOG_LEVEL=info
```

### Configuration DNS pour l'API (Dynadot)

1. Dans Railway > Service API > Settings > Domains > "Custom Domain"
2. Ajouter `api.clair.vote`
3. Railway donne un CNAME target
4. Dans Dynadot > DNS Settings :

```
Type    Name    Value
CNAME   api     [target-railway].up.railway.app
```

---

## 3. Recherche (Meilisearch)

### MVP : Fallback PostgreSQL (recommandé)

Pour le lancement, **Meilisearch n'est pas nécessaire**. Le code utilise automatiquement PostgreSQL comme fallback pour la recherche.

- Coût : 0€
- Performance : Suffisante pour ~1000 parlementaires
- Limitation : Pas de tolérance aux fautes de frappe

**Aucune variable à configurer** - le fallback s'active automatiquement si Meilisearch n'est pas disponible.

### Évolution : Ajouter Meilisearch

Si la recherche devient lente ou si vous voulez la tolérance aux typos :

| Option | Coût | Complexité |
|--------|------|------------|
| Railway (self-hosted) | ~5-10€/mois | Moyenne |
| Meilisearch Cloud | 29€/mois | Simple |

Pour activer sur Railway :
1. Ajouter un service Docker avec l'image `getmeili/meilisearch:latest`
2. Ajouter les variables :
   ```
   MEILISEARCH_URL=${{Meilisearch.RAILWAY_PRIVATE_DOMAIN}}:7700
   MEILISEARCH_KEY=votre-master-key
   ```
3. Appeler `POST /api/v1/search/reindex` pour indexer les données

---

## 4. Migrations Base de Données

Après le premier déploiement :

```bash
# Option 1 : Depuis votre machine locale
DATABASE_URL="postgresql://..." pnpm db:migrate:deploy

# Option 2 : Via Railway CLI
railway run pnpm db:migrate:deploy
```

Ou via l'interface Railway :
1. Service API > "Deploy" > "View Logs"
2. Vérifier que les migrations se sont bien exécutées

---

## 5. HelloAsso (Dons)

> Note : En attente de création du compte et du statut d'intérêt général.

1. Créer un compte sur [helloasso.com](https://www.helloasso.com)
2. Créer un formulaire de don
3. Récupérer les slugs dans l'URL du formulaire
4. Mettre à jour les variables Vercel :
   ```
   NEXT_PUBLIC_HELLOASSO_ORG_SLUG=clair-asso
   NEXT_PUBLIC_HELLOASSO_FORM_SLUG=soutenir-clair
   ```

---

## Checklist de Déploiement

### Pré-déploiement
- [x] Domaine clair.vote (Dynadot)
- [ ] Créer compte Vercel
- [ ] Créer compte Railway

### Déploiement
- [ ] Déployer frontend sur Vercel
- [ ] Configurer DNS `clair.vote` → Vercel
- [ ] Provisionner PostgreSQL sur Railway
- [ ] Provisionner Redis sur Railway
- [ ] Déployer API sur Railway
- [ ] Configurer DNS `api.clair.vote` → Railway
- [ ] Exécuter les migrations Prisma
- [ ] Ingérer les données (députés, sénateurs, scrutins)

### Post-déploiement
- [ ] Vérifier HTTPS actif sur les deux domaines
- [ ] Tester la recherche
- [ ] Tester les pages députés/sénateurs
- [ ] Vérifier les logs pour erreurs

---

## Budget Estimé (MVP)

| Service | Coût mensuel |
|---------|--------------|
| Vercel (Hobby) | 0€ |
| Railway (API) | ~5€ |
| Railway (PostgreSQL) | ~3€ |
| Railway (Redis) | ~2€ |
| Meilisearch | 0€ (fallback PG) |
| Domaine clair.vote | ~2€ |
| **Total** | **~12€/mois** |

---

## Commandes Utiles

```bash
# === Railway CLI ===
railway login
railway link              # Lier au projet
railway logs --follow     # Logs en temps réel
railway connect postgres  # Shell PostgreSQL
railway run <cmd>         # Exécuter une commande
railway variables         # Voir les variables

# === Vercel CLI ===
vercel login
vercel --prod             # Déployer en production
vercel env pull           # Récupérer les variables

# === Ingestion données ===
# (à exécuter après déploiement)
railway run pnpm ingestion:sync -- -d    # Députés
railway run pnpm ingestion:sync -- -S    # Sénateurs
railway run pnpm ingestion:sync -- -s    # Scrutins AN
```

---

## Troubleshooting

### L'API ne démarre pas
- Vérifier les logs Railway
- Vérifier que `DATABASE_URL` est bien configurée
- Vérifier que les migrations ont été exécutées

### La recherche ne fonctionne pas
- Normal si Meilisearch n'est pas configuré → fallback PostgreSQL utilisé
- Vérifier les logs pour "Meilisearch not available - search will use database fallback"

### Erreurs CORS
- Vérifier que `CORS_ORIGIN=https://clair.vote` est configuré sur Railway
- Vérifier que l'API est bien sur `api.clair.vote`
