# AGENTS.md — CLAIR

Instructions pour les agents de code (Codex, OpenCode, Copilot…).

## Le projet

CLAIR rend lisible l'activité du Parlement français (députés, sénateurs, scrutins, dossiers législatifs, amendements, lobbying) à partir des données ouvertes. Site : clair.vote ; documentation : docs.clair.vote. Projet associatif, **apartisan** : aucune opinion politique ne doit transparaître dans le code, les données ou les textes.

Monorepo pnpm 12 + Turbo. Deux fronts cohabitent pendant la migration :

- **`apps/site`** : le nouveau site (Next 16, React 19, Mantine 9), construit écran par écran sur `packages/*`, déployé sur beta.clair.vote. C'est là que se fait le travail front.
- **`apps/web`** : le site actuel (Next 14, Tailwind), en ligne sur clair.vote. **Il ne se modifie pas**, sauf correctif demandé explicitement.

Avant une tâche non triviale, lire la documentation dans `docs/` :
- `docs/01-guide/stack-technique.mdx` : architecture et choix techniques
- `docs/01-guide/guide-developpeur/contribution.mdx` : règles de contribution (elles priment sur ce fichier en cas de doute)
- `docs/02-donnees/` : modèle Prisma, sources, ingestion, qualité des données, enrichissement IA
- `docs/04-front/` : architecture du nouveau front, design system, catalogue des composants

## Où mettre quoi

### Nouveau front

| Besoin | Emplacement |
|---|---|
| Route du site | `apps/site/app/<route>/page.tsx` : `metadata`, chargement serveur (`apps/site/lib/api-server.ts`), puis l'écran ; rien d'autre |
| Écran | `packages/screens/src/<ecran-kebab>/` : `XxxScreen.tsx`, `params.ts` (état d'URL), `XxxScreen.module.css`, test, `fixtures.ts` (données fictives) |
| Composant réutilisable | `packages/ui/src/<catégorie>/<nom-kebab>/` (skill `clair-composant`), export dans `packages/ui/src/index.ts` |
| Story | à côté du composant (`Nom.stories.tsx`, skill `clair-story`) ; l'atelier `apps/storybook` n'a que sa configuration et l'introduction |
| Couleur, taille, rayon, ombre (token) | `packages/theme/src/tokens.ts`, puis `pnpm --filter @clair/theme generate` ; la doc et Storybook les lisent directement |
| Type d'une réponse de l'API | `packages/data/src/<domaine>.ts`, écrit à la main d'après les réponses relevées (pas généré depuis l'OpenAPI) |
| Accès aux données | `packages/api-client` (client HTTP, `useApiQuery`) |
| Configuration partagée (tsconfig, Vitest) | `packages/config` |
| Page de doc d'un composant | `docs/04-front/03-composants/<famille>/<nom-kebab>.mdx` (modèle : `badge.mdx`) |
| Architecture, design system | `docs/04-front/01-architecture/`, `docs/04-front/02-design-system/` |
| Test e2e du site | `e2e/site.*.spec.ts` ; route d'API simulée : `e2e/fake-api.mjs` |

### API, données, outillage

| Besoin | Emplacement |
|---|---|
| Route d'API | `apps/api/src/modules/<domaine>/` : `.controller.ts`, `.service.ts`, `.schema.ts` (Zod), tests à côté |
| Modèle de données | `apps/api/prisma/schema.prisma` + migration écrite à la main (voir « Pièges ») |
| Source open data / synchronisation | `services/ingestion/src/sources/<source>/` (un client par source, un test par parser) |
| Commande CLI d'ingestion | `services/ingestion/src/cli.ts` |
| Prompt ou enrichissement IA | `services/ingestion/src/llm/` |
| Contrôle de qualité des données | `services/ingestion/src/checks/` |
| Documentation | `docs/<NN-section>/*.mdx`, puis `pnpm docs:nav` |
| Note d'un changement notable (fragment) | `.changelog/<sujet>.md`, dans la même PR (skill `clair-changelog`, norme dans `docs/03-changelog/index.mdx`) |
| Page d'une version | `docs/03-changelog/vX-Y-Z.mdx`, seulement lors d'une version (`pnpm changelog:prepare`) |
| Version d'une dépendance du nouveau front | `catalog` de `pnpm-workspace.yaml` (skill `clair-deps`) |
| Skill d'agent | `.agents/skills/<nom>/SKILL.md` (`.github/skills` y pointe) |

Skills disponibles : `clair-react` (standards front), `clair-composant` (créer ou migrer un composant), `clair-story` (stories), `clair-verifier` (vérification et captures), `clair-deps` (dépendances à jour), `clair-changelog` (fragments et versions).

## Règles

- **Ordre de priorité** : demande explicite > ce fichier > configuration du dépôt (tsconfig, Biome, ESLint, CI) > conventions du code existant.
- **TypeScript strict**, pas de `any`, pas de `as` qui masque une erreur ; `import type` pour les types.
- **Inspecter avant de modifier** : chercher si un composant (`packages/ui/src/index.ts`), un écran, un helper ou un service existe déjà. Pas de nouvelle dépendance sans le signaler explicitement.
- **Une tâche = un changement ciblé** : pas de refactor non lié, pas de reformatage de fichiers non touchés.
- **Libellés de l'interface, documentation, messages de commit et commentaires en français** ; identifiants de code en anglais ou français selon le fichier existant.
- **Distinguer la donnée officielle de la donnée calculée ou générée par IA** (résumés Mistral, positions, statistiques) : dans l'interface, la documentation et l'API.
- **Données** : ne jamais inventer de données parlementaires (les fixtures sont fictives et le disent) ; ne jamais écrire en base de production ; ne jamais lire ni afficher `.env`.
- **Accessibilité** (RGAA / WCAG AA) : HTML sémantique, nom accessible pour chaque contrôle, navigation au clavier, focus visible, jamais la couleur seule pour porter une information (vote, groupe, statut).
- **Nouveau front** (détail : skill `clair-react`) : aucun `next/*` dans `packages/` ; données via `@clair/api-client`, jamais de `fetch` direct dans un écran ; navigateur → proxy `/api/v1` de `apps/site`, qui porte le secret interne ; état de page dans l'URL (`parseXxxParams` / `xxxParamsOf`) ; aucune valeur visuelle en dur (`var(--clair-…)`, CSS modules, pas de Tailwind).
- **`apps/web`** (correctif seulement) : données navigateur via TanStack Query et `lib/api.ts`, serveur via `fetchFromApi` (`lib/api-server.ts`), filtres dans l'URL (`hooks/useUrlFilters.ts`).
- **API** : toute route a un schéma Zod ; la référence OpenAPI de la doc en est générée, ne jamais l'écrire à la main.
- **Versions** : une PR notable ajoute un fragment `.changelog/<sujet>.md` (skill `clair-changelog`), sinon sa description contient, seule sur sa ligne, `Journal : aucun` (pas de labels GitHub). Ne jamais monter une version, créer, pousser ou déplacer un tag, ni publier une GitHub Release sans demande explicite du mainteneur.

## Pièges connus

- `pnpm db:migrate` ne fonctionne pas sur ce dépôt : une migration s'écrit à partir d'un `prisma migrate diff` relu, et une nouvelle table reçoit son trigger `updated_at` (`apps/api/prisma/triggers.sql`). Ne jamais lancer `db:push` ou `db:migrate` sans demande explicite.
- **Type-check en CI** : le job `front` le fait pour `packages/*`, `apps/storybook` et `apps/site`. Il reste désactivé pour `apps/web`, `apps/api` et `services/ingestion`. `apps/web` et l'API passent (0 erreur) ; l'ingestion garde une erreur préexistante (TS1470 dans `slug-stabilite.test.ts`) : ne pas en ajouter de nouvelles, et le lancer quand même sur le workspace touché. Préférer `pnpm --filter <workspace> type-check` au `pnpm type-check` racine.
- **Deux outils de format** : Biome (`pnpm check`, `pnpm fix`) couvre `packages/*`, `apps/site`, `apps/storybook`, `scripts/changelog`, `e2e` et les fichiers de configuration racine (`biome.jsonc`) ; ESLint (`pnpm lint`) garde `apps/web`, `apps/api`, `services/ingestion`, `scripts/*.ts` et `apps/api/prisma`, et Prettier (`pnpm format`) l'existant, `docs` compris (`.prettierignore` exclut ce que formate Biome). Ne pas reformater un fichier de l'un avec l'autre.
- **pnpm 12** :
  - toute commande `pnpm add`, `pnpm update` ou `pnpm install` qui réécrit le lockfile peut relancer une résolution complète, qui fait bouger des versions indirectes de `apps/web`, de l'API ou de l'ingestion : **toujours relire `git diff pnpm-lock.yaml`** et n'y garder que ce que la tâche demande ;
  - `hoistPattern` (`pnpm-workspace.yaml`) ne hisse ni `lucide-react` ni `@types/react(-dom)`, présents en deux versions (React 18 pour `apps/web`, React 19 pour le nouveau front) : ne pas retirer ces exclusions ;
  - `packageExtensions` donne `@types/react` 18 en pair facultatif à des bibliothèques d'`apps/web`, **à leur version exacte** : si l'une d'elles change de version, l'extension ne s'applique plus et le build d'`apps/web` peut casser ;
  - `allowBuilds` liste les seuls scripts d'installation autorisés ; `minimumReleaseAge` refuse une version publiée depuis moins d'un jour (exclusion datée de Mantine 9.7.4 dans `pnpm-workspace.yaml`) ;
  - hors ligne, `pnpm install --frozen-lockfile --offline` échoue sur la vérification du lockfile s'il a changé et que les métadonnées du registre ne sont pas en cache.
- `apps/web` n'a pas de tests : vérifier une modification de l'interface par un build et dans le navigateur.
- Le thème de la doc (`docs/zudoku.config.tsx`) lit les tokens de `@clair/theme` : il n'y a plus de couleur à recopier. Les couleurs d'`apps/web` (`globals.css`, `tailwind.config.ts`) sont indépendantes et ne se modifient pas.
- Le build de la doc télécharge la spécification OpenAPI de l'API de production (`docs/scripts/export-openapi-spec.mjs`) ; les tests e2e du site n'en ont pas besoin (`--project=site`).
- Le build d'`apps/web` prérend `/sitemap.xml` contre l'API (`API_URL`, `CLAIR_INTERNAL_SECRET`). Celui d'`apps/site` ne dépend pas de l'API.

## Vérifier avant de rendre la main

```bash
pnpm check                                       # Biome (nouveau front, outillage)
pnpm lint                                        # ESLint (apps/web, apps/api, ingestion, scripts)
pnpm --filter <workspace touché> type-check
pnpm --filter <workspace touché> test            # api, ingestion, packages/* (pnpm test : tous)
pnpm --filter @clair/storybook test:stories      # si packages/ui change
pnpm --filter @clair/site build && pnpm test:e2e --project=site   # si apps/site ou packages/screens change
pnpm --filter @clair/web build                   # si apps/web change
pnpm docs:nav && pnpm docs:validate              # si docs/ change
pnpm changelog:test                              # si scripts/changelog change
pnpm --filter @clair/ingestion check-quality     # si ingestion / rattachement / IA change (base remplie)
pnpm changelog:check                             # fragment de la PR, si elle est notable
```

Signaler toute commande qui n'a pas pu être lancée, et pourquoi.

## Git

- **Ne jamais commiter ni pousser sans demande explicite du mainteneur**, à chaque fois : une autorisation donnée pour un commit ne vaut pas pour les suivants. Les modifications restent dans l'arbre de travail tant qu'il ne l'a pas demandé.
- Pas de branches ni de worktrees de travail laissés derrière soi : un agent qui en crée les supprime une fois son travail repris.
- Branche depuis `master` : `feat/…`, `fix/…`, `docs/…`, `chore/…`.
- Conventional Commits **en français**, vérifiés par commitlint au commit (lefthook, `commitlint.config.cjs`) : `type(portée): description`, sans point final.
  - Types acceptés : `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
  - Portée libre mais en usage : `site`, `ui`, `theme`, `data`, `storybook`, `front`, `web`, `api`, `ingestion`, `ia`, `db`, `docs`, `repo`, `changelog`, ou un domaine (`senat`, `senatoriales`, `scrutins`…).
  - Sujets longs acceptés.
- Lefthook formate aussi les fichiers indexés avec Biome avant chaque commit (hooks installés par `pnpm install`).
- Une PR fait une chose ; un changement visuel est accompagné de captures.
