---
name: Composant ou écran
about: Créer ou faire évoluer un composant (packages/ui) ou un écran (packages/screens, apps/site)
---

## Contexte

<!-- Quel besoin ? Quelle page de apps/web est remplacée ? Capture ou maquette. -->

## À faire

- [ ] Props typées et variantes
- [ ] États : chargement, vide, erreur, désactivé (si pertinent)
- [ ] Clavier et focus, libellés accessibles, jamais la couleur seule
- [ ] Styles uniquement en CSS module avec `var(--clair-…)`
- [ ] Story (`Defaut`, états, mobile) et test (Vitest + Testing Library) ; e2e si parcours utilisateur
- [ ] Page `docs/04-front/03-composants/<famille>/<nom>.mdx` (modèle : `badge.mdx`)

## Critères d'acceptation

<!-- Ce qu'on vérifie pour fermer l'issue. -->
