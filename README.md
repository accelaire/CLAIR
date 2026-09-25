# CLAIR — Citoyen Libre, Analyse, Information, République

![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)
![TypeScript](https://img.shields.io/badge/typescript-5-blue)
![pnpm](https://img.shields.io/badge/pnpm-8.15-orange)

**Plateforme de transparence politique pour la jeune génération française.**

CLAIR agrège, croise et présente de manière accessible les données publiques sur l'activité des parlementaires (députés et sénateurs), le lobbying et les votes au Parlement français.

Le projet est **open source**, **apartisan** et **factuel** : zéro opinion, uniquement des données brutes et des sources vérifiables.
## Source

Le service d'`ingestion` agrège les données parlementaires françaises depuis des sources publiques officielles :
- l'**Assemblée nationale** via [data.assemblee-nationale.fr](https://data.assemblee-nationale.fr) et [assemblee-nationale.fr](https://www.assemblee-nationale.fr) (députés, organes, scrutins, amendements, dossiers, comptes rendus de séance et de commission, agenda, vidéos)
- le **Sénat** via [data.senat.fr](https://data.senat.fr) et [senat.fr](https://www.senat.fr) (sénateurs actuels et anciens, scrutins, amendements, dossiers, débats, agenda, commissions, vidéos)
- la **HATVP** via [hatvp.fr](https://www.hatvp.fr) (représentants d'intérêts, actions de lobbying, déclarations des parlementaires)
- le **ministère de l'Intérieur** via [data.gouv.fr](https://www.data.gouv.fr) (candidatures aux sénatoriales 2026)
- **Wikipedia** et **Wikidata** (éléments biographiques des fiches parlementaires)

La DILA, ancienne source des débats de l'Assemblée, ne publie plus rien depuis janvier 2026 ; les débats viennent désormais du portail open data de l'Assemblée.

En production, deux services planifiés sur Railway alimentent la base : un smart-sync complet chaque nuit à 3 h UTC (5 h à Paris en heure d'été, 4 h en hiver), qui ne retraite que les sources modifiées, et un rafraîchissement de l'agenda et des vidéos toutes les deux heures en journée. Un enrichissement IA (Mistral) rédige des résumés accessibles des scrutins, des dossiers et des sujets, ainsi que des fiches de parlementaires. Un générateur de sujets regroupe les dossiers de l'Assemblée et du Sénat qui portent sur le même texte. Chaque synchronisation est tracée dans les tables `source_states` et `sync_logs`.

Le détail (sources, orchestration, modèle de données et ERD, API, déploiement) est dans le [wiki](https://github.com/accelaire/CLAIR/wiki).

## Démarrage rapide

Prérequis : Node.js 20 (Node 18 ne suffit pas), pnpm 8, Docker et Docker Compose

```bash
pnpm install

# Un seul fichier d'environnement à la racine, lu par l'API et par l'ingestion
cp .env.example .env
ln -s ../../.env apps/api/.env
ln -s ../../.env services/ingestion/.env

pnpm docker:up
pnpm db:generate
pnpm db:push          # initialise le schéma localement (voir note migrations ci-dessous)
pnpm dev
```

> **Migrations** : `pnpm db:push` applique le schéma Prisma à la base locale sans créer de fichier de migration. C'est la seule méthode qui fonctionne sur une base neuve : l'historique des migrations du dépôt ne se rejoue pas depuis une base vide, ce qui fait aussi échouer `pnpm db:migrate` (`prisma migrate dev`). Les fichiers de migration servent à faire évoluer la base de **production**. Si ton changement de schéma doit y partir, génère le SQL en comparant l'ancienne version du schéma à la nouvelle, relis-le, et ajoute-le dans ta PR sous `apps/api/prisma/migrations/<AAAAMMJJHHMMSS>_<nom>/migration.sql` :
>
> ```bash
> cd apps/api
> git show origin/master:apps/api/prisma/schema.prisma > /tmp/schema-avant.prisma
> npx prisma migrate diff --from-schema-datamodel /tmp/schema-avant.prisma --to-schema-datamodel prisma/schema.prisma --script
> ```

```bash
# Ingestion (après un premier `pnpm --filter @clair/ingestion build`)
pnpm db:seed                     # ou : petit jeu de données de test
pnpm ingestion:sync -p           # parlementaires (députés + sénateurs)
pnpm ingestion:sync -s -l 50     # 50 scrutins
pnpm ingestion:sync --lo         # lobbying
pnpm ingestion:smart-sync -a     # tout, dans l'ordre de production (long)
pnpm ingestion:calculate-stats   # recalcul des stats (présence, loyauté…)
```

L'API REST est documentée via Swagger à `http://localhost:3001/docs` une fois le serveur lancé (en production : [api.clair.vote/docs](https://api.clair.vote/docs)).

> Pour contribuer ou auditer la solution, consulte notre [wiki](https://github.com/accelaire/CLAIR/wiki) ou contacte-nous par [mail](mailto:contact@clair.vote).

## Contact

- **Site** : [clair.vote](https://clair.vote)
- **Email** : contact@clair.vote
- **GitHub** : [github.com/accelaire/CLAIR](https://github.com/accelaire/CLAIR)
- **Issues** : [github.com/accelaire/CLAIR/issues](https://github.com/accelaire/CLAIR/issues)
- **Wiki** : [github.com/accelaire/CLAIR/wiki](https://github.com/accelaire/CLAIR/wiki)
