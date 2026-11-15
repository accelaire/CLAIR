---
niveau: correctif
type: outillage
public: [contributeurs]
pr: [133]
---

La racine du dépôt perd sa configuration morte : Husky et lint-staged (aucun hook versionné), `pnpm format` (Prettier sans configuration), les paquets vides `packages/`, `pnpm test:e2e`, six variables de `.env.example` et les `railway*.toml` que Railway ne lisait pas. La documentation donne les crons de production en UTC, relevés dans le tableau de bord Railway.
