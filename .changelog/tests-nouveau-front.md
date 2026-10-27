---
niveau: correctif
type: outillage
public: [contributeurs]
pr: []
---

La CI lance des tests de fumée du nouveau site (`pnpm test:e2e --project=site`) : chaque rubrique est construite contre un faux serveur d'API, sans jamais appeler la production, puis vérifiée (réponse, titre, erreurs, accessibilité avec axe). Les outils de test de `@clair/config` passent en dépendances de développement : l'image Docker de l'ingestion ne les embarque plus.
