---
niveau: correctif
type: outillage
public: [contributeurs]
pr: []
---

Une pull request sans changement notable s'en déclare par une ligne `Journal : aucun` dans sa description, au lieu du label `changelog:aucun` : le dépôt n'utilise plus de labels GitHub, y compris dans les modèles d'issues. `changelog:prepare --version` refuse une version qui n'est pas au format `X.Y.Z`.
