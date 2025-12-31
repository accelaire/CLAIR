# Contribuer à CLAIR

Merci de ton intérêt pour CLAIR ! Ce projet est open source et les contributions sont les bienvenues.

## Code de conduite

Ce projet est un outil citoyen et apartisan. Les contributions doivent rester factuelles et objectives. Aucune opinion politique ne doit transparaître dans le code ou la documentation.

## Comment contribuer

### Signaler un bug

1. Vérifie que le bug n'a pas déjà été signalé dans les [Issues](https://github.com/votre-org/clair/issues)
2. Ouvre une nouvelle issue avec :
   - Un titre clair et descriptif
   - Les étapes pour reproduire le bug
   - Le comportement attendu vs observé
   - Ton environnement (OS, Node.js, navigateur)

### Proposer une fonctionnalité

1. Ouvre une issue avec le label `enhancement`
2. Décris clairement la fonctionnalité et son utilité
3. Attends une validation avant de commencer le développement

### Soumettre du code

1. **Fork** le repo
2. **Clone** ton fork localement
3. **Crée une branche** depuis `main` :
   ```bash
   git checkout -b feature/ma-fonctionnalite
   # ou
   git checkout -b fix/mon-correctif
   ```
4. **Installe les dépendances** :
   ```bash
   pnpm install
   ```
5. **Fais tes modifications** en respectant les conventions ci-dessous
6. **Teste** ton code :
   ```bash
   pnpm lint
   pnpm type-check
   pnpm test
   ```
7. **Commit** avec un message clair (voir conventions)
8. **Push** ta branche :
   ```bash
   git push origin feature/ma-fonctionnalite
   ```
9. **Ouvre une Pull Request** vers `main`

## Conventions

### Structure des commits

Utilise des messages de commit clairs et en français :

```
type: description courte

[corps optionnel avec plus de détails]
```

Types :
- `feat` : Nouvelle fonctionnalité
- `fix` : Correction de bug
- `docs` : Documentation
- `style` : Formatage (pas de changement de code)
- `refactor` : Refactorisation
- `test` : Ajout/modification de tests
- `chore` : Maintenance (deps, config)

Exemple :
```
feat: ajout du filtre par groupe politique

Permet de filtrer les députés par leur groupe politique
dans la liste principale.
```

### Style de code

- **TypeScript** : Typage strict, pas de `any`
- **ESLint** : Respecte la config du projet (`pnpm lint`)
- **Prettier** : Formatage automatique
- **Nommage** :
  - Variables/fonctions : `camelCase`
  - Types/Interfaces : `PascalCase`
  - Fichiers : `kebab-case` ou `camelCase` selon le contexte

### Architecture

- **API** : Module pattern dans `apps/api/src/modules/`
- **Frontend** : Composants dans `apps/web/app/` ou `apps/web/components/`
- **Shared** : Types partagés dans `packages/shared/`

## Environnement de développement

```bash
# Prérequis
node >= 20.0.0
pnpm >= 8.0.0
docker

# Installation
pnpm install
cp .env.example .env
pnpm docker:up
pnpm db:generate
pnpm db:migrate
pnpm dev
```

## Sources de données

Si tu travailles sur l'ingestion de données :
- Respecte les rate limits des APIs externes
- Documente les transformations de données
- Ajoute des tests pour les parsers

## Questions

Pour toute question, ouvre une issue avec le label `question`.

---

Merci pour ta contribution !
