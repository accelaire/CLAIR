# AGENTS.md — CLAIR

Instructions pour les agents de code (Codex, OpenCode, Copilot…).

## Le projet

CLAIR rend lisible l'activité du Parlement français (députés, sénateurs, scrutins, dossiers législatifs, amendements, lobbying) à partir des données ouvertes. Site : clair.vote ; documentation : docs.clair.vote. Projet associatif, **apartisan** : aucune opinion politique ne doit transparaître dans le code, les données ou les textes.

Monorepo pnpm + Turbo. Avant une tâche non triviale, lire la documentation dans `docs/` :
- `docs/01-guide/stack-technique.mdx` : architecture et choix techniques
- `docs/01-guide/guide-developpeur/contribution.mdx` : règles de contribution (elles priment sur ce fichier en cas de doute)
- `docs/02-donnees/` : modèle Prisma, sources, ingestion, qualité des données, enrichissement IA

## Où mettre quoi

| Besoin | Emplacement |
|---|---|
| Page du site | `apps/web/app/<route>/` : `page.tsx` (serveur : metadata, `fetchFromApi`), puis `PageClient.tsx` (client) |
| Composant réutilisable | `apps/web/components/<domaine>/` (composant propre à une page : `apps/web/app/<route>/components/`) |
| Logique ou formatage front sans React | `apps/web/lib/` |
| Hook front | `apps/web/hooks/` |
| Couleurs / tokens | `apps/web/app/globals.css` (variables) et `apps/web/tailwind.config.ts`, à recopier dans `docs/zudoku.config.tsx` |
| Route d'API | `apps/api/src/modules/<domaine>/` : `.controller.ts`, `.service.ts`, `.schema.ts` (Zod), tests à côté |
| Modèle de données | `apps/api/prisma/schema.prisma` + migration écrite à la main (voir « Pièges ») |
| Source open data / synchronisation | `services/ingestion/src/sources/<source>/` (un client par source, un test par parser) |
| Commande CLI d'ingestion | `services/ingestion/src/cli.ts` |
| Prompt ou enrichissement IA | `services/ingestion/src/llm/` |
| Contrôle de qualité des données | `services/ingestion/src/checks/` |
| Documentation | `docs/<NN-section>/*.mdx`, puis `pnpm docs:nav` |
| Note d'un changement notable (fragment) | `.changelog/<sujet>.md`, dans la même PR (skill `clair-changelog`, norme dans `docs/03-changelog/index.mdx`) |
| Page d'une version | `docs/03-changelog/vX-Y-Z.mdx`, seulement lors d'une version (`pnpm changelog:prepare`) |
| Skill d'agent | `.agents/skills/<nom>/SKILL.md` (`.github/skills` y pointe) |

## Règles

- **Ordre de priorité** : demande explicite > ce fichier > configuration du dépôt (tsconfig, ESLint, CI) > conventions du code existant.
- **TypeScript strict**, pas de `any`, pas de `as` qui masque une erreur ; `import type` pour les types.
- **Inspecter avant de modifier** : chercher si un composant, un helper de `lib/` ou un service existe déjà. Pas de nouvelle dépendance sans le signaler explicitement.
- **Une tâche = un changement ciblé** : pas de refactor non lié, pas de reformatage de fichiers non touchés.
- **Libellés de l'interface, documentation, messages de commit et commentaires en français** ; identifiants de code en anglais ou français selon le fichier existant.
- **Distinguer la donnée officielle de la donnée calculée ou générée par IA** (résumés Mistral, positions, statistiques) : dans l'interface, la documentation et l'API.
- **Données** : ne jamais inventer de données parlementaires ; ne jamais écrire en base de production ; ne jamais lire ni afficher `.env`.
- **Accessibilité** (RGAA / WCAG AA) : HTML sémantique, nom accessible pour chaque contrôle, navigation au clavier, focus visible, jamais la couleur seule pour porter une information (vote, groupe, statut).
- **Front** : données navigateur via TanStack Query et `lib/api.ts` (proxy `/api/v1`) ; données serveur via `fetchFromApi` (`lib/api-server.ts`). Pas de `fetch` direct vers l'API publique. L'état des filtres vit dans l'URL (`hooks/useUrlFilters.ts`).
- **API** : toute route a un schéma Zod ; la référence OpenAPI de la doc en est générée, ne jamais l'écrire à la main.
- **Versions** : une PR notable ajoute un fragment `.changelog/<sujet>.md` (skill `clair-changelog`), sinon elle porte le label `changelog:aucun`. Ne jamais monter une version, créer, pousser ou déplacer un tag, ni publier une GitHub Release sans demande explicite du mainteneur.

## Pièges connus

- `pnpm db:migrate` ne fonctionne pas sur ce dépôt : une migration s'écrit à partir d'un `prisma migrate diff` relu, et une nouvelle table reçoit son trigger `updated_at` (`apps/api/prisma/triggers.sql`). Ne jamais lancer `db:push` ou `db:migrate` sans demande explicite.
- Le type-check est désactivé en CI (erreurs préexistantes dans `apps/web` et `services/ingestion`) : ne pas en ajouter de nouvelles ; le lancer quand même sur le workspace touché.
- `apps/web` n'a pas de tests : vérifier une modification de l'interface par un build et dans le navigateur.
- Le thème de `docs/zudoku.config.tsx` est une copie manuelle de `apps/web/app/globals.css` : un changement de couleur se fait aux deux endroits.
- Le build du web prérend `/sitemap.xml` contre l'API (`API_URL`, `CLAIR_INTERNAL_SECRET`).

## Vérifier avant de rendre la main

```bash
pnpm lint
pnpm --filter <workspace touché> type-check
pnpm test                                       # api + ingestion
pnpm --filter @clair/web build                  # si apps/web change
pnpm docs:validate                              # si docs/ change (après pnpm docs:nav)
pnpm --filter @clair/ingestion check-quality    # si ingestion / rattachement / IA change (base remplie)
pnpm changelog:check                            # fragment de la PR, si elle est notable
```

Signaler toute commande qui n'a pas pu être lancée, et pourquoi.

## Git

- Branche depuis `master` : `feat/…`, `fix/…`, `docs/…`, `chore/…`.
- Conventional Commits **en français** : `type(portée): description`. Types : `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`. Portées utilisées : `web`, `api`, `ingestion`, `ia`, `db`, `docs`.
- Une PR fait une chose ; un changement visuel est accompagné de captures.
