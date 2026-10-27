---
name: clair-react
description: Apply the CLAIR front-end standards (DINUM, beta.gouv.fr, La Suite numérique, DesignGouv adapted to CLAIR) when creating, modifying or reviewing React, TypeScript, JavaScript, HTML or CSS code in packages/*, apps/site, apps/storybook or docs.
---

# CLAIR — standards front

> Principe : ne pas satisfaire une checklist au détriment du produit. Ces règles servent un logiciel compréhensible, accessible, sûr et maintenable ; le contexte du dépôt et les besoins des citoyens priment.

## Priorité

1. Demande explicite.
2. `AGENTS.md`.
3. Configuration du dépôt et CI (`package.json`, `tsconfig*.json`, `biome.jsonc`, workflows).
4. Conventions du code existant.
5. Ce skill (standards DINUM / beta.gouv / La Suite / DesignGouv).

## 1. Inspecter avant de modifier

- Lire `package.json`, le `tsconfig` et `biome.jsonc` du workspace, la configuration de test.
- Chercher le composant, le hook ou l'utilitaire qui existe déjà (`packages/ui/src/index.ts`, `packages/screens`, `packages/api-client`).
- Aucune nouvelle dépendance si une dépendance existante suffit ; sinon, la signaler.

## 2. Code uniforme

- Biome formate et lint (`pnpm check`, `pnpm fix`) ; jamais de désactivation large, une exception locale justifiée (`biome-ignore` + raison) si inévitable.
- Pas de code commenté, pas de `console.log`, pas d'import mort.
- Imports relatifs **avec extension** dans `packages/*` (`./Badge.tsx`), `import type` pour les types.

## 3. TypeScript strict

- Pas de `any`, pas de `as` pour faire taire le compilateur, pas d'assertion non nulle `!`.
- États nuls et optionnels modélisés (`T | null`), props et frontières d'API typées.
- Les types du domaine viennent de `@clair/data`, **écrits à la main** d'après les réponses relevées sur l'API (ils ne sont pas générés depuis l'OpenAPI) : ne jamais les redéclarer dans un écran ; un champ nouveau de l'API s'ajoute d'abord dans `packages/data/src/<domaine>.ts`.

## 4. Composants React

- Fonctions fléchées, petites, une responsabilité, JSDoc en français (rôle + règle d'usage).
- État dérivé plutôt que dupliqué ; **pas de `useEffect` pour une valeur calculable au rendu** ; pas de mémoïsation prématurée.
- Composants de `packages/` : **jamais `next/*`** ; liens et navigation via `Link` / `useNavigation` de `@clair/ui`.

## 5. Données et asynchrone

- Données uniquement via les hooks de `@clair/api-client` (TanStack Query) ; **jamais de `fetch` direct** dans un écran ou un composant.
- Les **6 états UI** : initial, chargement, succès, vide, erreur récupérable, désactivé / non autorisé (`QueryStates` de `@clair/ui`).
- **État de page dans l'URL** : `parseXxxParams` / `xxxParamsOf` dans `params.ts` de l'écran.

## 6. Accessibilité (RGAA 4.1, niveau AA) — obligatoire

- HTML sémantique d'abord (`button` pour une action, `a` pour naviguer, `nav`, `main`, `dialog`) ; ARIA seulement si le HTML ne suffit pas.
- Chaque champ relié à son `label` et à son message d'erreur ; chaque contrôle a un nom accessible.
- Clavier complet, **focus visible**, aucun piège ; lien d'évitement « Aller au contenu ».
- Images informatives avec `alt`, SVG décoratifs `aria-hidden="true"` ; un graphique a une alternative textuelle (tableau).
- **Jamais la couleur seule** (vote, groupe, statut) : texte, icône ou motif en plus.
- Contraste ≥ 4,5:1 pour le texte, ≥ 3:1 pour les composants, en clair **et** en sombre.

## 7. Tests

- Tester ce que voit l'utilisateur (`getByRole`, libellés accessibles), pas les classes CSS.
- Composant : Vitest + Testing Library (`renderWithProviders`). Écran : `renderScreen` avec les fixtures. Stories : rendues et vérifiées a11y par Storybook.
- Un bug corrigé = un test de non-régression.

## 8. Sécurité

- Aucun secret dans le code ; jamais un secret serveur dans `NEXT_PUBLIC_*` (le secret interne `CLAIR_INTERNAL_SECRET` reste côté serveur, dans le proxy).
- Pas de `dangerouslySetInnerHTML` sans contenu assaini.

## 9. Design system CLAIR

- Bibliothèque : **Mantine 9**, thémée par `@clair/theme`. **Interdits** : `@codegouvfr/react-dsfr`, `@gouvfr/dsfr`, la police Marianne, l'identité visuelle de l'État. Le DSFR inspire seulement les normes (structure, breakpoints, focus, espacements, accessibilité).
- Toujours partir de la **documentation Mantine 9** ; democracy-watch est en Mantine 8, son code ne se recopie pas tel quel.
- **Jamais de valeur en dur** (couleur, taille, rayon, ombre) : `var(--clair-…)`. Pour une nouvelle valeur : token dans `packages/theme/src/tokens.ts`, puis `pnpm --filter @clair/theme generate`.
- **CSS modules** uniquement (`Nom.module.css`), variantes en attributs `data-*` ; **pas de Tailwind** hors de `apps/web`.
- Un composant = un dossier `packages/ui/src/<catégorie>/<nom-kebab>/` (skill `clair-composant`), avec story (skill `clair-story`) et page de doc `docs/04-front/03-composants/<famille>/<nom>.mdx`.
- Un écran = un dossier `packages/screens/src/<ecran-kebab>/` ; une route de `apps/site` ne fait que passer ses paramètres à l'écran.
- **`apps/web` ne se modifie pas** (site actuel, remplacé par `apps/site`), sauf correctif demandé explicitement.
- Toujours distinguer la donnée **officielle** de la donnée **calculée** ou **produite par IA**.

## 10. Avant de rendre la main

1. Relire le diff, retirer le code de débogage.
2. `pnpm check`, puis `pnpm --filter <workspace touché> type-check` et `pnpm --filter <workspace touché> test` (le `pnpm type-check` racine inclut `apps/web`, qui a des erreurs préexistantes).
3. Pour une interface : `pnpm build` du workspace, captures (skill `clair-verifier`), `pnpm test:e2e --project=site` si une page de `apps/site` change.
4. Fragment `.changelog/` si le changement est notable (skill `clair-changelog`).
5. Signaler toute commande non lancée, et pourquoi.

## Références

- [La Suite numérique — handbook](https://suitenumerique.gitbook.io/handbook) · [règles d'accessibilité](https://github.com/suitenumerique/dev-handbook/blob/main/accessibility.md) · [sécurité](https://github.com/suitenumerique/dev-handbook/blob/main/security.md)
- [beta.gouv — standards](https://standards.beta.gouv.fr/standards)
- [DesignGouv — mémo dev](https://design.numerique.gouv.fr/outils/memo-dev/) · [checklist dev](https://design.numerique.gouv.fr/fr/outils/checklist-dev/)
- [Mantine 9](https://mantine.dev/)
