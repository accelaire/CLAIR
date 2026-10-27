---
niveau: correctif
type: outillage
public: [contributeurs]
pr: []
---

Le dépôt passe à pnpm 12.15, une seule version lue partout dans `packageManager` : en local via corepack, en CI et dans les images Docker de l'API et de l'ingestion (qui utilisaient jusqu'ici pnpm 9, 8.15 ou « latest »). Les scripts d'installation autorisés sont déclarés dans `pnpm-workspace.yaml`. La migration ne change aucune version des dépendances de `apps/web`, de l'API ni de l'ingestion : le lockfile reprend leurs versions d'avant, et les types de React 18 de `apps/web` ne sont plus remplacés par ceux de React 19 du nouveau front (le build de `apps/web` en échouait au type-check).
