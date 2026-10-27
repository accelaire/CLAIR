---
name: clair-changelog
description: Write the CLAIR change fragment (.changelog/<sujet>.md) of a pull request, or prepare a CLAIR version (docs/03-changelog/vX-Y-Z.mdx, version bump, tag message). Use when finishing a pull request that changes the site, the API, the data, the methodology or the contributor tooling, when asked for a changelog entry, or when asked to prepare a release or a version.
---

# CLAIR — fragments de changement et versions

La norme fait foi : `docs/03-changelog/index.mdx`. Deux niveaux, à ne jamais confondre :

- **Fragment** : une note par pull request notable, dans `.changelog/<sujet>.md`, écrite dans la PR.
- **Version** : un palier `vX.Y.Z` qui regroupe les fragments en attente. Seul le mainteneur la déclenche.

## Mode 1 — Écrire le fragment d'une pull request

1. Lire le changement : `git diff master...HEAD --stat`, puis les fichiers clés.
2. Décider s'il est notable : effet visible sur le site, l'API, les données, la méthodologie ou l'outillage des contributeurs.
   Sinon, ne rien écrire et dire que la description de la PR doit contenir, seule sur sa ligne, `Journal : aucun` (pas de labels GitHub).
3. Choisir le niveau :
   - `majeur` : rupture pour les réutilisateurs (route ou champ d'API retiré ou changé de sens) ;
   - `mineur` : nouveauté (page, source, champ d'API ajouté, méthodologie) ;
   - `correctif` : correction ou amélioration sans nouveauté.
   En cas d'hésitation, prendre le plus haut et le dire.
4. Créer `.changelog/<sujet-en-kebab-case>.md` (nom unique, sans date) :
   ```md
   ---
   niveau: mineur
   type: fonctionnalite   # fonctionnalite | correction | donnees | methodologie | api | outillage
   public: [citoyens]     # citoyens | reutilisateurs | contributeurs
   pr: [123]              # [] si la PR n'existe pas encore
   ---

   Une à trois phrases en français, au présent, compréhensibles sans connaître le code.
   ```
5. Rédaction :
   - l'effet pour le lecteur, pas l'implémentation ;
   - la route ou le champ d'API concernés ;
   - ce qui est calculé ou produit par IA, dit comme tel ;
   - apartisan ;
   - 600 caractères au plus ;
   - `type: api` + `niveau: majeur` ⇒ « À faire de votre côté : … ».
6. Vérifier : `pnpm changelog:check`.

Une PR = un fragment, en général. Plusieurs fragments seulement si la PR mêle des changements de natures différentes (par exemple une nouveauté et une rupture d'API).

## Mode 2 — Préparer une version (uniquement sur demande explicite)

1. Partir de `master` à jour, sur une branche `chore/release-vX.Y.Z`.
2. `pnpm changelog:prepare --essai` : version calculée (niveau le plus haut des fragments ; en 0.x, une rupture monte le mineur), commits et PR depuis le dernier tag, **PR sans fragment**.
   Pour chaque PR sans fragment, regarder la PR (`gh pr view <n> -R accelaire/CLAIR`) et signaler celles qui auraient dû en avoir un.
3. `pnpm changelog:prepare` (avec `--niveau` ou `--version` seulement si on le demande) : écrit `docs/03-changelog/vX-Y-Z.mdx`, monte les `package.json`, supprime les fragments.
4. Rédiger la page, sur le modèle de `docs/03-changelog/v0-5-0.mdx`. Le titre reste « Version vX.Y.Z ».
   - `description` du frontmatter : les thèmes du palier, en une ligne (elle devient la première ligne du tag).
   - **En bref** : trois à cinq lignes, puis un tableau « Pour qui / Ce qui change » (citoyens, réutilisateurs, contributeurs).
   - **Faits marquants** : une section `##` par nouveauté importante. Chacune contient :
     - une explication accessible sans connaître le code ;
     - un lien vers la page du site ;
     - un schéma `<Mermaid title="…" chart={\`flowchart LR …\`} />` quand il y a un enchaînement ou une structure ;
     - un exemple `curl` sur `https://api.clair.vote` quand l'API change. **Vérifier chaque appel** : il doit répondre.
   - **Notes complètes** : les fragments regroupés en `###` par thème, réécrits mais sans perte d'information. C'est ce qui devient le message du tag.
   - Supprimer toute mention « À COMPLÉTER » et le commentaire d'aide.
5. `pnpm docs:nav`, `pnpm docs:validate`, `pnpm --filter @clair/api test`.
6. Commit `chore(release): vX.Y.Z`. Mettre dans la description de la PR le message du tag (`node scripts/changelog/tag-message.mjs vX.Y.Z`).
7. **Ne jamais créer, pousser, déplacer ni supprimer un tag, ni publier une GitHub Release.** Le mainteneur le fait après le merge (commandes dans `docs/03-changelog/index.mdx`).
