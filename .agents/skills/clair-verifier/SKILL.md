---
name: clair-verifier
description: Verify a CLAIR front-end change end to end (Biome, typecheck, Vitest, Storybook stories and a11y, screenshots read back, docs validation, site build and e2e). Use before handing back any change to packages/*, apps/site, apps/storybook or docs, or when asked to check a component or a screen.
---

# CLAIR — vérifier un changement front

Lancer **dans cet ordre** et s'arrêter au premier échec pour corriger. Signaler toute commande qui n'a pas pu être lancée.

```bash
pnpm check                                   # Biome : format + lint
pnpm --filter <workspace> type-check          # @clair/ui, @clair/screens, @clair/site…
pnpm --filter <workspace> test               # Vitest (unitaires, composants, écrans)
pnpm --filter @clair/storybook test:stories  # stories rendues dans le navigateur + a11y
pnpm docs:nav && pnpm docs:validate          # si une page de doc change
```

## Voir le rendu (obligatoire pour une interface)

1. Storybook en fond : `pnpm --filter @clair/storybook dev` (port 6006).
2. Captures d'une story, en clair, en sombre et en mobile :
   ```bash
   pnpm storybook:capture composants-fondations-badge--defaut
   pnpm storybook:capture composants-fondations-badge--defaut --theme dark
   pnpm storybook:capture composants-fondations-badge--defaut --viewport xs
   ```
3. **Lire chaque PNG** (`apps/storybook/.captures/`) et vérifier : rien de coupé ou de superposé, contrastes, focus visible, texte en français, pas de débordement horizontal en mobile.
4. Pour un écran de `apps/site` : `pnpm --filter @clair/site build`, puis `pnpm test:e2e --project=site` (navigateur : `pnpm exec playwright install chromium` la première fois). Le site y tourne devant un faux serveur d'API local (`e2e/fake-api.mjs`, listes vides), jamais la production : chaque rubrique de `e2e/site.fumee.spec.ts` doit répondre, porter un seul `h1`, sans erreur ni violation axe grave. Une rubrique nouvellement portée s'ajoute à sa liste `RUBRIQUES`. Ces tests ne font ni captures ni contrôle du mobile : le rendu se relit dans Storybook (étapes 1 à 3) ou avec `pnpm --filter @clair/site dev` (port 3010).

## Rapport

Terminer par la liste des commandes lancées avec leur résultat, les captures relues, et ce qui reste à vérifier par un humain.
