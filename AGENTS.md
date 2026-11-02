# AGENTS.md — CLAIR

Instructions pour les agents de code (Codex, OpenCode, Copilot…). Claude Code lit `CLAUDE.md`, ignoré par git : un `CLAUDE.md` local peut importer ce fichier par une ligne `@AGENTS.md`.

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

- **Ordre de priorité** : demande explicite > guide de contribution > ce fichier > conventions du code existant. La configuration du dépôt (tsconfig, ESLint, CI) s'applique dans tous les cas.
- **TypeScript strict**, pas de `any`, pas de `as` qui masque une erreur ; `import type` pour les types.
- **Inspecter avant de modifier** : chercher si un composant, un helper de `lib/` ou un service existe déjà. Pas de nouvelle dépendance sans le signaler explicitement.
- **Une tâche = un changement ciblé** : pas de refactor non lié, pas de reformatage de fichiers non touchés.
- **Libellés de l'interface, documentation, messages de commit et commentaires en français** ; identifiants de code en anglais ou français selon le fichier existant.
- **Distinguer la donnée officielle de la donnée calculée ou générée par IA** (résumés Mistral, positions, statistiques) : dans l'interface, la documentation et l'API.
- **Données** : ne jamais inventer de données parlementaires ; ne jamais écrire en base de production ; ne jamais lire ni afficher `.env`.
- **Accessibilité** (RGAA / WCAG AA) : HTML sémantique, nom accessible pour chaque contrôle, navigation au clavier, focus visible, jamais la couleur seule pour porter une information (vote, groupe, statut).
- **Front** : données navigateur via TanStack Query et `lib/api.ts` (proxy `/api/v1`) ; données serveur via `fetchFromApi` (`lib/api-server.ts`). Pas de `fetch` direct vers l'API publique. L'état des filtres vit dans l'URL (`hooks/useUrlFilters.ts`).
- **API** : toute route a un schéma Zod ; la référence OpenAPI de la doc en est générée, ne jamais l'écrire à la main.
- **Documentation** : elle vit dans `docs/` (docs.clair.vote), pas dans le wiki GitHub. Un changement de comportement que `docs/` décrit met à jour la page concernée dans la même PR.
- **Versions** : une PR notable ajoute un fragment `.changelog/<sujet>.md` (skill `clair-changelog`), sinon elle porte le label `changelog:aucun`. Ne jamais monter une version, créer, pousser ou déplacer un tag, ni publier une GitHub Release sans demande explicite du mainteneur.

## Environnement

- **Node 24** (`.nvmrc`). Sous Node 20, `services/ingestion/src/utils/encodage.test.ts` échoue volontairement : `TextDecoder('latin1')` n'y décode pas en windows-1252 comme sous Node 24. Sous Node 18, la CLI d'ingestion plante au chargement de `undici`.
- **Un seul `.env`**, à la racine (copie de `.env.example`) ; `apps/api/.env` et `services/ingestion/.env` sont des liens symboliques vers lui (`docs/01-guide/guide-developpeur/demarrage-local.mdx`). Certaines variables de `.env.example` ne sont lues par aucun code : chercher dans le code avant de s'y fier.
- Sans `MISTRAL_API_KEY`, l'enrichissement IA est sauté sans erreur : un passage sans clé ne prouve rien sur l'IA.

## Modèle de données : ce qu'il faut savoir avant d'y toucher

Référence complète : `docs/02-donnees/modele-prisma.mdx` (dont « Ce que l'API n'expose pas »).

- **`Parlementaire` est une personne.** Il n'y a pas de modèle `Depute` : députés et sénateurs partagent la table et se distinguent par leurs mandats (`MandatParlementaire`, `Mandat`). `/deputes` et `/senateurs` sont deux vues sur la même table.
- **Le groupe politique est un attribut du mandat, jamais de la personne.** Un vote, une statistique ou un prompt IA qui porte sur le passé prend le groupe du mandat en cours à la date des faits, pas le groupe actuel. Les statistiques sont bornées aux périodes de mandat.
- **`GroupePolitique.nom` est le code figé par la source** (`UMP` pour Les Républicains, `SOC`, `LREM`) et sert de clé de rapprochement ; le libellé d'usage est `nomCourt`. Côté API, une extension Prisma (`apps/api/src/plugins/prisma.ts`) remplace `nom` par `nomCourt` à chaque lecture : comparer en SQL sur les colonnes, jamais sur un `nom` déjà lu.
- **Pas de comptes** : ni `User`, ni authentification. L'API est publique et en lecture seule.
- Les fonctions gouvernementales sont dans `MembreGouvernement`, pas dans les mandats parlementaires.
- Sénatoriales 2026 : résultats et mandats locaux se joignent aux candidatures par identifiants source stables, jamais par clé étrangère.
- **Un numéro n'est pas une clé.** Numéros de scrutin et d'amendement se répètent d'une chambre, d'une législature ou d'une lecture à l'autre, et les homonymes existent : tout rapprochement porte la chambre et la législature.

## API

- Tout est servi sous `/api/v1`, sauf `/health`, `/health/ready` et `/health/live`, à la racine (`/api/v1/health` répond 404). Swagger : `/docs`.
- `/search` interroge Postgres par Prisma : il n'y a pas de moteur de recherche dans la pile.

## Ingestion et sources

- La CLI (`services/ingestion/src/cli.ts`) compte bien plus de commandes que les scripts du `package.json` : `pnpm --filter @clair/ingestion exec tsx src/cli.ts <commande>`. Liste : `docs/02-donnees/commandes-cli.mdx`. `check-ia-quality` n'a pas de script.
- `pnpm ingestion:backfill` resynchronise députés et sénateurs ; il ne rattrape pas l'historique.
- Pas de file de messages : chaque commande s'exécute jusqu'au bout, la concurrence passe par `p-limit`.
- Les comptes rendus intégraux de la DILA ne publient plus rien depuis janvier 2026 ; les débats de séance de l'Assemblée viennent de syceron. La base LEGI de la DILA, elle, reste à jour.
- Le Sénat n'a pas d'open data pour les commissions, l'agenda et les débats : ces données sont lues sur son site HTML, dont la structure peut changer sans préavis.

## Pièges connus

- **Pas de rapprochement par sous-chaîne sur un texte libre.** Chercher `LR`, `SOC`, `UE` ou un nom de famille « n'importe où » dans un libellé a déjà attribué en masse des scrutins, des amendements et des thèmes au mauvais groupe ou au mauvais député. Rapprocher par identifiant (`auteurRef`, uid de la source) ou par mot entier.
- **Tri total.** Un `ORDER BY` qui pagine, ou qui désigne « le dernier » ou « le majoritaire », se termine par une colonne unique ; sinon les pages sautent des lignes et les ex æquo tombent au hasard d'une exécution à l'autre.
- **Une passe « compléter si `IS NULL` » ne corrige rien** : elle fige les erreurs passées. Un rattachement corrigé se rejoue aussi sur les lignes déjà remplies.
- **Prisma** : `_count` sur une relation agrège toute la table liée à chaque appel ; `set` sur une relation plusieurs-à-plusieurs efface puis réinsère tous les liens et date le parent à chaque passage (passer par `alignerLiens`, `services/ingestion/src/utils/synchro-differentielle.ts`). Dans une requête SQL brute écrite en chaîne JS, l'antislash d'une regex Postgres se double (`\\s`), sinon elle ne trouve rien, sans erreur.
- **`sourceData`** (blob brut de la source) ne sort jamais dans une réponse de liste.
- **IA** : le prompt ne reçoit que des faits sourcés ; aucun calcul (âge, durée) n'est demandé au modèle ; une abstention en bloc est une position ; un champ réécrit par le modèle n'entre pas dans le hash de contenu, sinon tout le corpus est régénéré à chaque passage.
- `pnpm db:migrate` ne fonctionne pas sur ce dépôt : une migration s'écrit à partir d'un `prisma migrate diff` relu, et une nouvelle table reçoit son trigger `updated_at` (`apps/api/prisma/triggers.sql`). `pnpm db:push` (qui enchaîne `db:triggers`) sert à créer une base locale **vide** ; sur une base existante, ne lancer ni `db:push` ni `db:migrate` sans demande explicite.
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
pnpm --filter @clair/ingestion exec tsx src/cli.ts check-ia-quality   # si l'enrichissement IA change
pnpm docs:erd                                   # si le schéma Prisma change
pnpm changelog:check                            # fragment de la PR, si elle est notable
```

Signaler toute commande qui n'a pas pu être lancée, et pourquoi.

## Git

- Branche depuis `master` : `feat/…`, `fix/…`, `docs/…`, `chore/…`.
- Conventional Commits **en français** : `type(portée): description`. Types : `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`. Portées utilisées : `web`, `api`, `ingestion`, `ia`, `db`, `docs`.
- Une PR fait une chose ; un changement visuel est accompagné de captures.
