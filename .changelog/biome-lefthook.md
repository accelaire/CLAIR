---
niveau: correctif
type: outillage
public: [contributeurs]
pr: []
---

Biome formate et vérifie le code du nouveau front et l'outillage récent (`pnpm check`, `pnpm fix`, contrôlé en CI) ; lefthook remplace husky, dont aucun hook n'était actif : formatage des fichiers indexés avant chaque commit et vérification de la forme `type(portée): sujet` des messages (portées libres, sujets longs acceptés). Le catalog de `pnpm-workspace.yaml` fixe les versions exactes du nouveau front.
