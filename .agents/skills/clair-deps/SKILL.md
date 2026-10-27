---
name: clair-deps
description: Survey and upgrade CLAIR dependencies to their latest stable versions through the pnpm catalog, checking peer dependencies between packages, one family per pull request. Use when asked to update dependencies, check for outdated packages, or before starting a new phase of the front-end plan.
---

# CLAIR — dépendances à jour

Règle : **dernière version stable** de chaque paquet, épinglée **exactement** dans le `catalog` de `pnpm-workspace.yaml` ; les `package.json` référencent `catalog:`.

## Étapes

1. Relever : `pnpm outdated -r` puis, pour chaque paquet concerné, `npm view <paquet> version` et `npm view <paquet>@<version> peerDependencies engines`.
2. Vérifier les **dépendances croisées** avant de monter :
   - `@mantine/*` (tous à la même version) ⇄ `react` ;
   - `@mantine/charts` ⇄ `recharts` ; `@mantine/dates` ⇄ `dayjs` ;
   - `storybook` + `@storybook/*` (même version) ⇄ `vite`, `vitest` ;
   - `vitest` + `@vitest/*` ⇄ `vite`, Node (`engines`) ;
   - `next` ⇄ `react` ;
   - `typescript` : une version majeure qui retire l'API JS casse Next, tsup et les outils de docgen.
3. **Une famille par PR** (`mantine`, `storybook`, `vitest`, `next+react`, `biome`…), commit `chore(deps): …`.
4. Mettre à jour le catalog, `pnpm install`, puis **relire le diff de `pnpm-lock.yaml`** : seules les entrées de la famille montée doivent changer. Une résolution complète par pnpm 12 fait aussi bouger des versions indirectes d'`apps/web`, de l'API ou de l'ingestion ; ne pas les garder (voir « Pièges connus » dans `AGENTS.md`). Une version publiée depuis moins d'un jour est refusée (`minimumReleaseAge`) : attendre plutôt que l'exclure, ou dater l'exclusion dans `pnpm-workspace.yaml` comme celle de Mantine. Ensuite la vérification complète (skill `clair-verifier`) et les tests de `apps/api` et `services/ingestion` si une dépendance partagée bouge.
5. Lire le changelog de chaque montée de version majeure et noter les ruptures dans la PR.
6. Ne **jamais** monter `apps/web` (remplacé par `apps/site`) sauf correctif de sécurité.
