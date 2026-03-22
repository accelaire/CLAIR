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
- l'API Open Data de l'Assemblée Nationale (députés, scrutins, dossiers, amendements)
- le Sénat via data.senat.fr (sénateurs, scrutins, interventions)
- la HATVP pour les données de lobbying (lobbyistes et déclarations)
- la DILA pour les débats (comptes rendus intégraux)

Les synchronisations des données sont planifiés à des heures stratégiques : 
- sync complet à 5h du matin
- scrutins à 12h et 19h en semaine
- lobbying le dimanche

Un enrichissement IA utilise Mistral pour générer des résumés accessibles des scrutins et dossiers.  Un générateur de sujets croise les données Assemblée-Sénat pour regrouper les dossiers législatifs apparentés. L'ensemble des opérations est tracé dans des tables SourceState et SyncLog pour la traçabilité et le monitoring.

## Démarrage rapide

Prérequis :   Node.js >= 20.0.0,  pnpm >= 8.0.0, Docker & Docker Compose

```bash
pnpm install
cp apps/api/.env.example apps/api/.env


pnpm docker:up
pnpm db:generate
pnpm db:migrate
pnpm dev

# Ingestion
pnpm ingestion:sync -- -p   # ingest parlementaires (deputés + sénateur)
pnpm ingestion:sync -- -s   # ingest scrutins
pnpm ingestion:sync -- --lo # ingest lobby
pnpm ingestion:smart-sync   # ingest tout (avec détection intélligente)
pnpm ingestion:calculate-stats # exemple : taux de présence des parlementaires
pnpm ingestion:schedule     # 
```

> Pour plus d'information, que ce soit pour nous aider à développer et/ou auditer notre solution, veilliez rejoindre notre [wiki](https://github.com/accelaire/CLAIR/wiki) pour plus informations technique ou nous joindre par [mail](mailto:contact@clair.vote).

## Contact

- **Site** : [clair.vote](https://clair.vote)
- **Email** : contact@clair.vote
- **GitHub** : [github.com/accelaire/CLAIR](https://github.com/accelaire/CLAIR)
- **Issues** : [github.com/accelaire/CLAIR/issues](https://github.com/accelaire/CLAIR/issues)
- **Wiki** : [github.com/accelaire/CLAIR/wiki](https://github.com/accelaire/CLAIR/wiki)