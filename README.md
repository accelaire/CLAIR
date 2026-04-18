# CLAIR — Citoyen Libre, Analyse, Information, République

![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)
![TypeScript](https://img.shields.io/badge/typescript-5.3-blue)
![pnpm](https://img.shields.io/badge/pnpm-8.15-orange)

**Plateforme de transparence politique pour la jeune génération française.**

CLAIR agrège, croise et présente de manière accessible les données publiques sur l'activité des parlementaires (députés et sénateurs), le lobbying et les votes au Parlement français.

Le projet est **open source**, **apartisan** et **factuel** : zéro opinion, uniquement des données brutes et des sources vérifiables.
## Source

Le service d'`ingestion` agrège les données parlementaires françaises depuis plusieurs sources gouvernementales officielles. Il interroge quatre sources principales :
- l'**Assemblée Nationale** via [data.assemblee-nationale.fr](https://data.assemblee-nationale.fr) et [data.gouv.fr](https://www.data.gouv.fr) (députés, scrutins, dossiers, amendements)
- le **Sénat** via [data.senat.fr](https://data.senat.fr) (sénateurs, scrutins, interventions)
- la **HATVP** pour les données de lobbying (lobbyistes et déclarations)
- la **DILA** pour les débats (comptes rendus intégraux)

En production, un CRON Railway déclenche un smart-sync complet tous les jours à 5h du matin. Un enrichissement IA utilise Mistral Small pour générer des résumés accessibles des scrutins et dossiers. Un générateur de sujets croise les données Assemblée-Sénat pour regrouper les dossiers législatifs apparentés. L'ensemble des opérations est tracé dans des tables SourceState et SyncLog pour la traçabilité et le monitoring.

## Démarrage rapide

Prérequis :   Node.js >= 20.0.0,  pnpm >= 8.0.0, Docker & Docker Compose

```bash
pnpm install
cp apps/api/.env.example apps/api/.env

pnpm docker:up
pnpm db:generate
pnpm db:push          # initialise le schéma localement (voir note migrations ci-dessous)
pnpm dev
```

> **Migrations** : `pnpm db:push` synchronise le schéma Prisma avec la base locale sans créer de fichier de migration — c'est la méthode recommandée pour le développement local. Les fichiers de migration présents dans le repo servent uniquement à faire évoluer la base de **production**. Si tu modifies le schéma Prisma et que le changement doit partir en prod, génère un fichier de migration avec `pnpm db:migrate --create-only`, vérifie-le, et inclus-le dans ta PR.

```bash
# Ingestion (après un premier `pnpm --filter @clair/ingestion build`)
pnpm ingestion:sync -- -p        # parlementaires (députés + sénateurs)
pnpm ingestion:sync -- -s        # scrutins
pnpm ingestion:sync -- --lo      # lobbying
pnpm ingestion:smart-sync -- -a  # tout (détection intelligente des changements)
pnpm ingestion:calculate-stats   # recalcul des stats (présence, loyauté…)
```

L'API REST est documentée via Swagger à `http://localhost:3001/docs/static/index.html` une fois le serveur lancé.

> Pour contribuer ou auditer la solution, consulte notre [wiki](https://github.com/accelaire/CLAIR/wiki) ou contacte-nous par [mail](mailto:contact@clair.vote).

## Contact

- **Site** : [clair.vote](https://clair.vote)
- **Email** : contact@clair.vote
- **GitHub** : [github.com/accelaire/CLAIR](https://github.com/accelaire/CLAIR)
- **Issues** : [github.com/accelaire/CLAIR/issues](https://github.com/accelaire/CLAIR/issues)
- **Wiki** : [github.com/accelaire/CLAIR/wiki](https://github.com/accelaire/CLAIR/wiki)
