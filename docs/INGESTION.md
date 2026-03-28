# Guide d'Ingestion des Données CLAIR

Ce document décrit les procédures d'ingestion des données depuis les différentes sources publiques.

---

## Vue d'ensemble

CLAIR agrège des données de 4 sources principales :

| Source | Données | API/Format |
|--------|---------|------------|
| [Assemblée Nationale](https://data.assemblee-nationale.fr) | Députés, scrutins, votes, amendements | API REST JSON |
| [Sénat](https://data.senat.fr) | Sénateurs, scrutins, votes | API REST JSON + HTML scraping |
| [HATVP](https://www.hatvp.fr/open-data) | Lobbyistes, actions de lobbying | CSV Open Data |
| [DILA](https://echanges.dila.gouv.fr) | Interventions en séance | XML Comptes Rendus |

---

## Prérequis

```bash
# Services Docker requis
pnpm docker:up

# Base de données initialisée
pnpm db:generate
pnpm db:migrate
```

---

## Commandes CLI

### Syntaxe générale

```bash
pnpm ingestion:sync -- [chambre] [type] [options]
```

Le CLI `sync` repose sur deux axes composables :

1. **Chambre** (optionnel) : `--an` ou `--se` — sans filtre, les deux chambres sont synchronisées
2. **Type de données** : `-p`, `-s`, `--in`, `--am`, `--do`, `--lo`, `-g`

### `sync` — Options de synchronisation

#### Filtres de chambre

| Option | Alias long | Description |
|--------|------------|-------------|
| `--an` | `--assemblee-nationale` | Assemblée Nationale uniquement |
| `--se` | `--senat` | Sénat uniquement |

#### Types de données

| Option | Alias long | Description |
|--------|------------|-------------|
| `-p` | `--parlementaires` | Députés + sénateurs |
| `-g` | `--groupes` | Groupes politiques |
| `-s` | `--scrutins` | Scrutins (votes) |
| `--in` | `--interventions` | Interventions en séance |
| `--am` | `--amendements` | Amendements |
| `--do` | `--dossiers` | Dossiers législatifs |
| `--lo` | `--lobbyistes` | Lobbyistes + actions (HATVP) |

#### Modificateurs

| Option | Description |
|--------|-------------|
| `-f, --full` | Synchronisation complète (backfill) |
| `-l, --limit <n>` | Limiter le nombre d'éléments |
| `-c, --circonscriptions` | Inclure les circonscriptions (avec `-p --an`) |
| `--no-actions` | Ne pas synchroniser les actions de lobbying (avec `--lo`) |
| `--ameli` | Mode AMELI legacy pour amendements Sénat (avec `--se --am`) |
| `--texte-ids <ids>` | IDs texte AMELI (séparés par des virgules, avec `--se --am`) |
| `--dry-run` | Mode simulation |

#### Opérations de liaison

| Option | Description |
|--------|-------------|
| `--link --in` | Lier les interventions aux scrutins (par seanceRef ou date) |
| `--link --am` | Lier les scrutins aux amendements (par parsing du titre) |
| `--enrich --am` | Enrichir les scrutins par scraping HTML (filtrer avec `--an`/`--se`) |
| `--reset` | Réinitialiser les liens existants avant de re-lier |

### Tableau des combinaisons `sync`

| Commande | Action |
|----------|--------|
| | Sync incrémental (députés + sénateurs) |
| `-- -p` | Parlementaires (députés + sénateurs) |
| `-- --an -p` | Députés uniquement |
| `-- --se -p` | Sénateurs uniquement |
| `-- --an -p -c` | Députés + circonscriptions |
| `-- -s` | Scrutins AN + Sénat |
| `-- --an -s` | Scrutins AN uniquement |
| `-- --se -s` | Scrutins Sénat uniquement |
| `-- --in` | Interventions AN + Sénat |
| `-- --an --in` | Interventions AN uniquement (DILA) |
| `-- --se --in` | Interventions Sénat uniquement |
| `-- --am` | Amendements AN + Sénat |
| `-- --an --am` | Amendements AN uniquement |
| `-- --se --am` | Amendements Sénat (CSV senat.fr) |
| `-- --se --am --ameli` | Amendements Sénat legacy (AMELI) |
| `-- --do` | Dossiers législatifs AN + Sénat |
| `-- --an --do` | Dossiers AN uniquement |
| `-- --se --do` | Dossiers Sénat uniquement (DOSLEG) |
| `-- --lo` | Lobbyistes + actions (HATVP) |
| `-- --lo --no-actions` | Lobbyistes sans actions |
| `-- --link --in` | Lier interventions ↔ scrutins |
| `-- --link --am` | Lier scrutins ↔ amendements |
| `-- --enrich --am` | Enrichir amendements (AN + Sénat) |
| `-- --an --enrich --am` | Enrichir amendements AN uniquement |
| `-- --se --enrich --am` | Enrichir amendements Sénat uniquement |

> Tous les types acceptent `-l <n>` pour limiter le nombre d'éléments (ex : `-- -s -l 50`).

### `smart-sync` — Synchronisation intelligente

Ne synchronise que les sources ayant changé depuis la dernière exécution.

| Option | Alias long | Description |
|--------|------------|-------------|
| `-a` | `--all` | Synchroniser tout dans le bon ordre |
| `-f` | `--force` | Forcer même si pas de changement |
| `-s` | `--scrutins` | Inclure les scrutins (AN + Sénat) |
| `--am` | `--amendements` | Inclure les amendements (AN + Sénat) |
| `--do` | `--dossiers` | Inclure les dossiers législatifs |
| `--in` | `--interventions` | Inclure les interventions |
| `--lo` | `--lobbying` | Inclure les lobbyistes |
| `-l` | `--limit <n>` | Limite globale pour tous les types |
| | `--sources <s>` | Sources spécifiques (séparées par virgules) |

```bash
pnpm ingestion:smart-sync -- -a            # Tout, delta uniquement
pnpm ingestion:smart-sync -- -s --am       # Scrutins + amendements
pnpm ingestion:smart-sync -- -a -l 100     # Tout, limité à 100 par type
pnpm ingestion:smart-sync -- -a -f         # Tout, forcer le sync
```

---

## Procédures d'ingestion

### 1. Première installation (Backfill complet)

```bash
# Ordre recommandé pour une base vide :

# 1. Députés (crée aussi les groupes et circonscriptions)
pnpm ingestion:sync -- --an -p -c

# 2. Sénateurs (crée aussi les groupes Sénat)
pnpm ingestion:sync -- --se -p

# 3. Scrutins AN (avec votes individuels)
pnpm ingestion:sync -- --an -s -l 100

# 4. Scrutins Sénat
pnpm ingestion:sync -- --se -s -l 50

# 5. Lobbyistes et actions
pnpm ingestion:sync -- --lo -l 500

# 6. (Optionnel) Interventions
pnpm ingestion:sync -- --an --in -l 50

# 7. (Optionnel) Amendements
pnpm ingestion:sync -- --an --am -l 200

# 8. Réindexer Meilisearch
curl -X POST http://localhost:3001/api/v1/search/reindex
```

### 2. Synchronisation incrémentale (quotidienne)

```bash
# Met à jour députés et sénateurs
pnpm ingestion:sync
```

### 3. Mise à jour des scrutins

```bash
# Derniers scrutins AN
pnpm ingestion:sync -- --an -s -l 20

# Derniers scrutins Sénat
pnpm ingestion:sync -- --se -s -l 10
```

### 4. Mise à jour du lobbying

```bash
# Avec les actions
pnpm ingestion:sync -- --lo -l 100

# Sans les actions (plus rapide)
pnpm ingestion:sync -- --lo --no-actions -l 100
```

---

## Sources de données - Détails

### Assemblée Nationale

**Endpoint** : `https://data.assemblee-nationale.fr/`

**Données récupérées** :
- Liste des députés actifs (17e législature)
- Groupes politiques
- Scrutins publics avec votes individuels
- Amendements déposés

**Mapping des votes** :
| API | Base de données |
|-----|-----------------|
| `pour` | `pour` |
| `contre` | `contre` |
| `abstention` | `abstention` |
| `nonVotant` | `absent` |

### Sénat

**Endpoint** : `https://data.senat.fr/`

**Données récupérées** :
- Liste des sénateurs actifs
- Groupes politiques du Sénat
- Scrutins publics avec votes
- Circonscriptions sénatoriales (par département)

**Mapping des votes Sénat** :
| JSON | Base de données |
|------|-----------------|
| `p` | `pour` |
| `c` | `contre` |
| `a` | `abstention` |
| `n` | `absent` |

### HATVP (Lobbying)

**Source** : CSV téléchargeables depuis [hatvp.fr/open-data](https://www.hatvp.fr/open-data)

**Fichiers utilisés** :
- `representants.csv` - Liste des représentants d'intérêts
- `activites.csv` - Activités déclarées
- `exercices.csv` - Données financières (budget, salariés)
- `actions_details.csv` - Détails des actions (cibles, décisions)

**Types de lobbyistes** :
| Catégorie HATVP | Type CLAIR |
|-----------------|------------|
| Société commerciale | `entreprise` |
| Association | `association` |
| Cabinet d'avocats | `cabinet` |
| Syndicat professionnel | `syndicat` |
| Organisation professionnelle | `organisation_pro` |

### DILA (Interventions)

**Source** : Comptes rendus des débats parlementaires (XML)

**Données récupérées** :
- Interventions des députés en séance
- Date, type d'intervention
- Contenu textuel
- Mots-clés extraits automatiquement

---

## Logs et monitoring

### Logs d'exécution

Les logs sont affichés en console avec le format :
```
{"level":"info","time":"2024-...","msg":"Starting deputes sync..."}
```

### Logs en base de données

Chaque synchronisation crée une entrée dans `sync_logs` :
```sql
SELECT * FROM sync_logs ORDER BY started_at DESC LIMIT 10;
```

### Vérification des données

```bash
# Compter les parlementaires
docker exec clair-postgres psql -U clair -d clair -c "
  SELECT chambre, COUNT(*) FROM parlementaires GROUP BY chambre;
"

# Compter les scrutins
docker exec clair-postgres psql -U clair -d clair -c "
  SELECT chambre, COUNT(*) FROM scrutins GROUP BY chambre;
"

# Compter les lobbyistes
docker exec clair-postgres psql -U clair -d clair -c "
  SELECT type, COUNT(*) FROM lobbyistes GROUP BY type ORDER BY COUNT(*) DESC;
"
```

---

## Planification (Scheduling)

### Option 1 : Cron système

```cron
# /etc/cron.d/clair-ingestion

# Sync quotidien des parlementaires (6h00)
0 6 * * * cd /path/to/clair && pnpm ingestion:sync -- -p >> /var/log/clair/sync.log 2>&1

# Sync des scrutins (toutes les 4h)
0 */4 * * * cd /path/to/clair && pnpm ingestion:sync -- -s -l 10 >> /var/log/clair/scrutins.log 2>&1

# Sync lobbying (hebdomadaire, dimanche 3h00)
0 3 * * 0 cd /path/to/clair && pnpm ingestion:sync -- --lo >> /var/log/clair/lobbying.log 2>&1

# Réindexation Meilisearch (après chaque sync)
30 6 * * * curl -X POST http://localhost:3001/api/v1/search/reindex
```

### Option 2 : Systemd timers

```ini
# /etc/systemd/system/clair-sync.service
[Unit]
Description=CLAIR Data Sync

[Service]
Type=oneshot
WorkingDirectory=/path/to/clair
ExecStart=/usr/bin/pnpm ingestion:sync
User=clair

# /etc/systemd/system/clair-sync.timer
[Unit]
Description=Run CLAIR sync daily

[Timer]
OnCalendar=*-*-* 06:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl enable clair-sync.timer
sudo systemctl start clair-sync.timer
```

### Option 3 : GitHub Actions (CI/CD)

```yaml
# .github/workflows/sync.yml
name: Data Sync

on:
  schedule:
    - cron: '0 6 * * *'  # Tous les jours à 6h UTC
  workflow_dispatch:      # Déclenchement manuel

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: pnpm install
      - run: pnpm ingestion:sync
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

## Résolution de problèmes

### Erreur de connexion API

```
Error: Request failed with status code 503
```
→ L'API source est temporairement indisponible. Réessayer plus tard.

### Timeout sur les scrutins

```
Error: timeout of 60000ms exceeded
```
→ Réduire le nombre avec `-l 10` (ex : `-- -s -l 10`)

### Doublons de parlementaires

```sql
-- Trouver les doublons
SELECT nom, prenom, COUNT(*) FROM parlementaires
GROUP BY nom, prenom HAVING COUNT(*) > 1;

-- Supprimer les doublons (garder le plus récent)
DELETE FROM parlementaires WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY nom, prenom ORDER BY updated_at DESC) as rn
    FROM parlementaires
  ) t WHERE rn > 1
);
```

### Réinitialiser les index Meilisearch

```bash
# Vider les index
curl -X DELETE http://localhost:3001/api/v1/search/indexes

# Réindexer
curl -X POST http://localhost:3001/api/v1/search/reindex
```

---

## Fréquence recommandée

| Type de données | Fréquence | Raison |
|-----------------|-----------|--------|
| Parlementaires | 1x/jour | Changements rares |
| Scrutins | 4x/jour | Sessions parlementaires |
| Lobbying | 1x/semaine | Déclarations trimestrielles |
| Interventions | 1x/semaine | Volume important |
| Amendements | 1x/semaine | Volume important |

---

## Architecture du service d'ingestion

```
services/ingestion/
├── src/
│   ├── cli.ts                    # Point d'entrée CLI
│   ├── workers/
│   │   └── sync.ts               # Fonctions de synchronisation
│   ├── sources/
│   │   ├── assemblee-nationale/
│   │   │   ├── client.ts         # API AN Open Data
│   │   │   ├── deputes-client.ts # Députés
│   │   │   └── scrutins-client.ts# Scrutins AN
│   │   ├── senat/
│   │   │   ├── senateurs-client.ts
│   │   │   └── scrutins-client.ts
│   │   ├── hatvp/
│   │   │   └── client.ts         # Parsing CSV HATVP
│   │   └── dila/
│   │       └── interventions-client.ts
│   └── utils/
│       └── logger.ts
└── package.json
```
