# Audit : anciens écrans (`apps/web`) et nouveaux écrans (`apps/site`)

PR [#115](https://github.com/accelaire/CLAIR/pull/115), branche `feature/ui-mantine`, après la fusion de `master` (`b8a7bec`) du 14/11/2026.

## Ce qu'on a comparé, et comment

- **Ancien** : `apps/web` (Next 14, Tailwind), en ligne sur clair.vote, **dans son état de `master` au 14/11** : il compte donc les 83 commits fusionnés aujourd'hui (bilan des gouvernements, présence des sénateurs aux votes solennels, liens Légifrance des amendements, durcissement du proxy…).
- **Nouveau** : `apps/site` (Next 16, Mantine 9) et ses paquets (`packages/screens`, `packages/ui`, `packages/data`).
- **Méthode** : lecture du code des deux côtés, écran par écran (contenu, données et endpoints, état d'URL, provenance, accessibilité). **Aucune capture ni aucun rendu dans un navigateur** : le rendu visuel reste à contrôler (voir « Ce qui n'a pas été vérifié »).
- **Verdicts** : « À parité », « Parité partielle », « Absent du nouveau front », « Le nouveau fait mieux ». **Priorités** : P1 bloque la bascule, P2 est important, P3 relève du confort.

## Synthèse

**Le portage est large et propre.** Toutes les routes de l'ancien site existent dans le nouveau, aux mêmes adresses, avec leurs images Open Graph, à trois exceptions près. Sur les 54 écrans et sujets examinés :

| Verdict | Nombre |
|---|---|
| Le nouveau fait mieux | 9 |
| À parité | 15 |
| Parité partielle | 27 |
| Absent du nouveau front | 3 (`/gouvernements`, `/gouvernements/[slug]`, `/api/live-now`) |

**Le gros de l'écart vient de `master`, pas de la PR.** La PR a été construite contre un `apps/web` antérieur au 26/10. Les 83 commits fusionnés aujourd'hui ont fait avancer l'ancien front, et **aucun de leurs ajouts visibles n'est encore dans le nouveau** : ni les types (`packages/data` ne connaît ni `presenceSolennel` au bon sens, ni `gouvernement`, `motionCensure`, `renvois`), ni les écrans. C'est un rattrapage à planifier, pas un défaut de conception.

**Le nouveau fait déjà mieux** sur : les listes de parlementaires (un écran pour deux chambres, tri, comparateur dans l'URL), `/recherche` (rendu serveur, type de résultat dans l'URL), `/commissions`, `/lobbying/[id]` (l'ancien n'affichait jamais le parlementaire rencontré : il lisait `action.depute` quand l'API renvoie `parlementaire`), `/lobbying/actions`, le JSON-LD, les pages d'erreur, le lien d'évitement et l'accessibilité en général (contrastes testés, couleur jamais seule, tableau sous chaque graphique). La provenance (« calculé par CLAIR », « résumé IA ») y est mieux signalée.

## Les points bloquants (P1)

### 1. Présence des sénateurs : la règle de `master` n'est appliquée nulle part

Au Sénat, le taux « tous scrutins » compte les bulletins déposés par le groupe ; `master` (a30a8a7, 8b5ca6b, bc00209) affiche donc la **présence aux votes solennels** pour les sénateurs, « Ne vote pas » pour un président d'assemblée, « — » plutôt que 0 % quand la présence n'est pas mesurable, et « n.c. » sous 50 scrutins dans les classements. Le nouveau front affiche le taux brut partout :

- fiche (`FicheStatistiques.tsx`), comparateur (`StatsComparees.tsx`), fiche de groupe, classements ;
- **classements : l'API trie les sénateurs sur `presenceSolennel`, l'écran affiche `presence`** : le chiffre ne suit pas l'ordre du tableau ;
- sénatoriales 2026 : libellé « Présence » au lieu de « Présence (solennels) », et un sous-titre qui affirme encore « dépasse 95 % de présence » (`packages/screens/src/senatoriales/` : `SortantCard.tsx` l. 135, `DistributionBilan.tsx` l. 16, `GraphiqueScreen.tsx` l. 47, `lib/graphiques.ts` l. 47-48). Cela touche la page principale, les 64 circonscriptions et le graphique `presence` ;
- `/comprendre/parlementaire` n'a pas les trois paragraphes ajoutés par `master` sur cette mesure ;
- les types de `packages/data` contredisent l'API (`presence` non nullable dans `parlementaire-activite.ts`, `presenceSolennel` documenté « nul au Sénat »).

**Par où commencer** : corriger les types de `packages/data`, puis un helper unique de présence (l'équivalent de `apps/web/lib/presence.ts`), puis les écrans.

### 2. Le brut des sources (`sourceData`) part encore dans le HTML

`master` (ce9d67c) le retire à toute profondeur (`sansDonneesSource`, `apps/web/lib/api-server.ts`). Le nouveau front ne le retire qu'au premier niveau, et seulement pour les fiches parlementaires (`apps/site/app/_parlementaires/chargement.ts:78`) et les scrutins (`apps/site/app/scrutins/[numero]/page.tsx:37`). La fiche lobbyiste le transmet en entier à un écran client (`apps/site/app/lobbying/[id]/page.tsx:67`), et les mandats des fiches l'embarquent probablement. **Correctif** : un nettoyage profond dans `apps/site/lib/api-server.ts`, appliqué à toutes les réponses.

### 3. Images de partage fausses

- Fiches parlementaires : « null % » quand un taux manque (`apps/site/app/_parlementaires/image-partage.tsx:85-87`, qui interpole `stats.presence` sans tester `null`), et présence des sénateurs non ramenée aux solennels.
- `/scrutins/[numero]` : pas d'image propre au scrutin (l'ancienne montrait le titre, la barre de votes et le résultat).

### 4. Bilan des gouvernements absent

- `/gouvernements` et `/gouvernements/[slug]` n'existent pas (types, écrans, routes, sitemap, entrée de menu, lien du pied de page). La description de ce qu'il faut porter est dans la section « Parlementaires » plus bas.
- En dépendent : le bandeau « Le Gouvernement et ce texte » (fiches dossier et sujet), le bandeau de motion de censure (fiche scrutin), le filtre « Motions de censure » (`/scrutins?censure=`) et le filtre « Origine du texte » (`/dossiers?gouvernement=projets|49-3`). **Un lien partagé avec l'un de ces filtres affiche aujourd'hui toute la liste, sans prévenir.**
- Sur les fiches : titres sous le nom (fonction au Gouvernement, présidences), fonction dans le `<title>`, bilan par poste.

### 5. Amendements sans liens Légifrance

`master` (a1676e3) rend le dispositif avec les renvois au droit en vigueur, liés à Légifrance (`TexteAmendement.tsx`). `AmendementCard` n'affiche que du texte brut, sur les fiches scrutin et dossier. À reprendre en texte, jamais en HTML injecté.

### 6. Variables de bascule (configuration, pas code)

À poser sur le projet Vercel du nouveau site le jour de la bascule : `SITE_INDEXABLE=true` (sinon tout reste en `noindex`), `NEXT_PUBLIC_SITE_URL=https://clair.vote` (lue au build ; la valeur par défaut est la bêta), `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URLS`, `CLAIR_INTERNAL_SECRET`.

## Les écarts importants (P2)

- **Anciens liens à ancre** : `master` (a14e21f) ouvre l'onglet désigné par l'ancre (`#interventions`, `#amendements`, `#historique`, `#vote`, `#debats`…) ; le nouveau front lit `?onglet=` ou `?tab=`. Ces liens, déjà partagés, ouvrent le premier onglet. Lire l'ancre en repli suffirait.
- **`?compare=true`** est lu comme le slug d'un élu sur les comparateurs.
- **Direct de l'agenda disparu** : `apps/web/app/api/live-now/route.ts` interroge les sites de l'Assemblée et du Sénat, et `useLiveNow` l'appelle toutes les 5 minutes depuis l'agenda et l'accueil (« En direct », bandeau « en cours »). Rien d'équivalent dans `apps/site` ni dans l'API, alors qu'`EvenementCard` sait afficher `live` et `liveHref`.
- **Proxy `/api/v1`** : le nouveau vérifie seulement le préfixe `/api/v1/` ; `master` (41de433, ac04516) n'accepte que des segments en liste blanche et relaie exactement le chemin contrôlé, avec 114 lignes de tests. Le reste du proxy est égalé ou meilleur.
- **SEO** : `robots.ts` n'exclut plus `/api/` une fois le site indexable ; le sitemap n'a pas les gouvernements.
- **Cache CDN des sénatoriales** : l'ancien `vercel.json` le posait, `apps/site/vercel.json` non.
- **Fonctions perdues sur les fiches** : filtre par type d'intervention, filtre de chambre, lien vers la séance ; bloc amendements du comparateur ; image de partage dynamique des classements.
- **Contenus** : la carte du nouveau contributeur sur `/soutenir`, l'encart « Soutenir » en bas des fiches député, sénateur et scrutin.

Les P3 (thématiques sur les cartes de scrutin, photos des élus, `nomCourt` des commissions, logos de lobbyistes, ancre `#event-<id>` de l'agenda, lien `/deputes/…` pour un sénateur rencontré par un lobbyiste…) sont listés dans les sections détaillées.

## Prendre de la hauteur sur la PR

1. **La PR est trop grosse pour être relue en l'état** : environ 88 000 lignes ajoutées en un commit, qui mêlent outillage (pnpm 12, Biome, lefthook, CI), design system, 40 écrans et documentation. Elle pourrait se découper sans perte : (a) outillage et lockfile ; (b) `@clair/theme`, `@clair/ui`, Storybook ; (c) `apps/site` et `@clair/screens`, en bêta ; (d) documentation « Front ». Chaque morceau est relisible et réversible seul.
2. **La bascule ne doit pas suivre la fusion.** Fusionner la PR et publier la bêta est sans risque : `apps/web` n'est pas touché. La bascule de clair.vote, elle, demande d'abord les P1 ci-dessus.
3. **Le risque principal est la dérive entre les deux fronts.** Tant qu'ils cohabitent, chaque évolution de `apps/web` crée une dette dans `apps/site` : 83 commits en trois semaines en ont produit l'essentiel de cet audit. Deux options : geler les fonctions d'`apps/web` (correctifs seulement, ce que dit déjà AGENTS.md) et faire tout le neuf dans `apps/site`, ou exiger qu'une PR qui change un écran d'`apps/web` porte le même changement dans `apps/site`.
4. **La logique métier est dupliquée.** Présence, fonctions en vue, texte d'amendement, gouvernements : `master` les a mises dans `apps/web/lib/*.ts`, testées. Le nouveau front devra les réécrire. Les déplacer dans un paquet partagé (ou les faire calculer par l'API) éviterait deux vérités, ce qui compte pour un site apartisan où un chiffre faux est un défaut public.
5. **Les types écrits à la main** (`packages/data`) sont le premier endroit où l'écart apparaît. Un test de contrat contre de vraies réponses de l'API (enregistrées) l'aurait signalé à la fusion.

## Ce qui n'a pas été vérifié

- Le rendu visuel : aucune capture, aucun écran ouvert dans un navigateur. Une comparaison visuelle demanderait les deux sites lancés contre la même API, avec des captures écran par écran (skill `clair-verifier`).
- Le poids réel de `sourceData` dans les mandats des fiches (non mesuré sur une vraie réponse).
- Le contenu exact de `scrutinJsonLd` et l'héritage éventuel de l'image Open Graph de rubrique par `/scrutins/[numero]`.

## Suivi des corrections (14/11/2026)

Corrections faites dans l'arbre de travail, **non commitées**. `pnpm check`, les type-checks (`data`, `ui`, `api-client`, `screens`, `site`, `api`), les tests (ui 297, screens 380, site 39, api 463), `test:stories` (303) et le build d'`apps/site` passent.

| Point de l'audit | État |
|---|---|
| P1-1 Présence des sénateurs (fiche, comparateur, groupe, classements, sénatoriales, `/comprendre/parlementaire`) | Fait. Helper unique `packages/data/src/presence.ts` (porté de `apps/web/lib/presence.ts`), types corrigés, classements triés et affichés sur la même valeur, « n.c. » sous 50 scrutins |
| P1-2 `sourceData` dans le HTML | Fait : retiré à toute profondeur de toute réponse chargée côté serveur (`apps/site/lib/donnees-source.ts`, appliqué dans `serverApi`) |
| P1-3 Images de partage | Fait : plus de « null % », présence aux votes solennels au Sénat ; image propre au scrutin (`apps/site/app/scrutins/[numero]/og/route.tsx`) |
| P1-4 Gouvernements | Fait : `/gouvernements`, `/gouvernements/[slug]` (onglets composition, textes, censure, postes), menu par rôle, pied de page, sitemap, titres sous le nom des fiches, bilan par poste, bandeaux « Le Gouvernement et ce texte » et motion de censure, filtres `?censure=` et `?gouvernement=` |
| P1-5 Liens Légifrance des amendements | Fait (`TexteAmendement` dans `packages/ui`, sans HTML injecté) |
| P1-6 Variables de bascule | Configuration Vercel, hors code : à poser le jour de la bascule |
| P2 Anciens liens à ancre | Fait : hook partagé `useOngletAncre` (fiches parlementaires, scrutin, dossier, commission, gouvernement) |
| P2 `?compare=true` | Fait |
| P2 Direct de l'agenda | Fait, à l'adresse `/api/v1/agenda/direct` (route locale d'`apps/site`, lue par `useApiQuery`) plutôt que `/api/live-now` |
| P2 Proxy `/api/v1` | Fait : contrôle de `master` repris, logique dans `apps/site/lib/api-proxy.ts`, tests `node --test` |
| P2 `robots.txt`, cache des sénatoriales, `/soutenir`, encart « Soutenir » des fiches | Faits |
| P2 Fonctions perdues des fiches (filtre d'interventions, filtre de chambre, lien vers la séance) | Faits |
| P2 Image de partage dynamique des classements, bloc amendements du comparateur | Faits (2e vague) : `apps/site/app/classements/og/route.tsx` (les anciennes adresses `/api/og?type=classement…` redirigent), `comparateur/AmendementsCompares.tsx` |
| P3 | Faits : ancre `#event-<id>` de l'agenda, lien vers un sénateur rencontré par un lobbyiste, avis sur les amendements, « X et N cosignataires », thématiques sur les cartes de scrutin, liens dans « Vote demandé par », « Lire le débat » et « Voir dans la séance », photos des élus (votants, débats), `nomCourt` des commissions. Reste : photos des membres sur la fiche groupe |
| Pages trop longues (constat des captures) | Faits (2e vague) : votes des étapes repliés (dossier, sujet), une seule séance ouverte dans les interventions, 16 élus par position puis « Afficher les autres » (scrutin), débats et séances paginés comme l'ancien (5 et 50 prises de parole) |
| Postes ministériels dans la frise, compteur « N · M » de l'onglet 49.3 et censure | Faits (2e vague), selon les décisions ci-dessous : `MandatsTimeline` (prop `postes`) et `Tabs` (`count` texte, `countLabel`) étendus, avec stories, tests et doc |

Constat apporté par les captures (`screenshots/`), **corrigé en 2e vague** (voir le tableau) :

- **P2 Fiche dossier trop longue** : sur `/dossiers/DLR5L17N52428` (projet de loi de finances 2026), la bêta déroule tous les scrutins du texte dans le parcours, sans pagination ni repli : 47 000 px de haut sur ordinateur, 126 000 px sur mobile, contre 5 200 px dans l'ancien. Les autres pages les plus longues de la bêta (commissions, sénatoriales, séance, interventions d'une fiche) méritent la même vérification.

Choix à relire :

- Une modification de l'API : `chambre` ajouté au `select` du parlementaire dans les quatre requêtes du lobbying (`apps/api/src/modules/lobbying/lobbying.controller.ts`), pour lier un sénateur à `/senateurs/…`.
- Séance `/reunions/…` : 50 prises de parole par page (au lieu de 200), comme l'ancien. Un lien `?debat=N` déjà partagé depuis la bêta ne tombe plus sur la même page.
- Fiche dossier : la bêta garde sa frise des étapes au-dessus de la liste, ce que l'ancien n'avait pas ; la page reste un peu plus haute que l'ancienne.
- Pendant la 2e vague, une mise à jour automatique de Storybook (versions 10.6.7 épinglées hors du `catalog`, port 3050, `eslint-plugin-storybook`, lockfile réécrit) s'est glissée dans l'arbre sans avoir été demandée : elle a été annulée, le lockfile est celui du commit de fusion.

## Décisions du mainteneur (QCM du 14/11/2026)

| Question | Décision |
|---|---|
| Pages trop longues pour une capture | Découper en tuiles (`beta-desktop-1.png`, `-2.png`…) |
| Postes ministériels sur la fiche d'un parlementaire | Dans la frise des mandats, comme l'ancien (`MandatsTimeline` à étendre) |
| Adresse du direct de l'agenda | `/api/v1/agenda/direct` (route d'`apps/site`) |
| `chambre` ajouté aux requêtes du lobbying (API) | Gardé |
| Compteur de l'onglet « 49.3 et censure » | Compteur en texte (« N · M ») avec un libellé pour les lecteurs d'écran (`Tabs` à étendre) |
| `nomCourt` des commissions | Toujours affiché, comme l'ancien |
| Suite git | Laisser dans l'arbre de travail, sans commit |
| `AUDIT.md` et `screenshots/` | Hors git (`.git/info/exclude`) |
| Mise à jour de Storybook (QCM du 16/11/2026) | Refaite par le `catalog` : Storybook 10.6.7, Vitest 5.1.0, port 3050 ; stories de tous les écrans, `play` partout, couverture avec seuils en CI |
| Chantiers suivants (16/11/2026) | Écarts visuels relevés sur les captures, couverture des écrans, vérification des fichiers Excalidraw |
| Suite git (16/11/2026) | Un seul commit avec toute la mise à jour, captures et fichiers Excalidraw compris (remplace « laisser dans l'arbre » et « hors git ») |
| Commentaires dans Excalidraw (16/11/2026) | Comme dans Figma : pastilles numérotées à poser sur les captures, et un encadré « Commentaires » par page pour les fils (auteur, date, réponses, résolu) |
| Import dans Figma (16/11/2026) | Pas de plugin fiable pour ouvrir un `.excalidraw` : un SVG par page (`screenshots/figma/`), plus la planche des composants |

## La fusion de `master` (14/11/2026)

- `master` d'accelaire/CLAIR (`b8a7bec`, 83 commits) fusionné dans `feature/ui-mantine` : commit local `23a82dd`, **non poussé**.
- Conflits réglés à la main : `docs/01-guide/stack-technique.mdx` et `docs/02-donnees/commandes-cli.mdx` (les deux versions gardées, avec la mention des tests du proxy d'`apps/web` venue de `master`).
- `pnpm-lock.yaml` : repris de la branche (pnpm 12 ne lit pas le format pnpm 8 de `master`), puis complété par `pnpm install --lockfile-only`. Paquets ajoutés : `@tricoteuses/tisseuse`, `tar-stream`, `@types/tar-stream` et leurs dépendances, `vitest` pour `apps/web`. Effet de bord : pnpm déduplique `rollup` 4.65.0 vers 4.54.0, déjà présent (pair facultatif côté doc et Storybook, Vite 8 bundle avec rolldown). Aucune autre version ne bouge.
- Vérifications : `pnpm check`, `pnpm lint`, type-check d'`apps/web`, de l'API et d'`apps/site`, tests d'`apps/web` (49) et de l'API (463), `pnpm docs:validate` passent. Ingestion : seule l'erreur TS1470 connue ; 5 tests échouent pour des raisons de machine (Node 22 au lieu de 24, binaire `zip` absent), sans lien avec la fusion. Non lancés : `test:stories`, le build et les e2e du site.
- `AGENTS.md` dit encore « `apps/web` n'a pas de tests » : ce n'est plus vrai depuis `master` (tests du proxy).

---

# Détail par écran


## Parlementaires, groupes, classements, gouvernements

Audit en lecture seule, le 14/11/2026, sur la branche `feature/ui-mantine` (master fusionné). Chaque constat vient de la lecture du code des deux côtés. Ce qui n'a pas été vérifié est signalé « non vérifié ».

Un même défaut revient sur plusieurs écrans. On l'appelle ici **règle #108** : au Sénat, un scrutin ordinaire se vote par groupe. Le taux « tous scrutins » (`presence`) mesure donc une participation, pas une présence. La présence d'un sénateur se lit aux votes solennels (`presenceSolennel`). Master l'applique partout dans `apps/web` (`apps/web/lib/presence.ts`, `presenceDe`). Le nouveau front ne l'applique presque nulle part. Le type `StatsParlementaireDetail` le dit même à tort : « nul au Sénat » (`packages/data/src/parlementaire-activite.ts:34`).

---

### /deputes et /senateurs (listes)

Ancien : `apps/web/app/deputes/page.tsx`, `apps/web/app/deputes/PageClient.tsx`, `apps/web/app/senateurs/page.tsx`, `apps/web/app/senateurs/PageClient.tsx`, `apps/web/components/comparison/*` · Nouveau : `apps/site/app/deputes/page.tsx`, `apps/site/app/senateurs/page.tsx`, `apps/site/app/_parlementaires/chargement.ts`, `packages/screens/src/parlementaires-liste/*`

**Verdict : Le nouveau fait mieux** (un seul écran pour les deux chambres, tri en plus, sélection du comparateur dans l'URL).

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| En-tête | Titre, « N députés sur 577 sièges — XVIIe législature » (ou « ont siégé »), source, « Comprendre les stats », Guide (AN) | Même phrase (`ParlementairesListeScreen.tsx`, `effectif`), source, « Comprendre les statistiques », Guide (AN), plus un sélecteur de chambre (`ChambreSwitch`) | À parité, avec le sélecteur en plus |
| Lien « Voir les archives » | Bouton vers la législature ou la session précédente (`PageClient.tsx` ~l. 245) | Absent. Le sélecteur de période suffit quand il y a plusieurs périodes | Petite perte |
| API | `/deputes` (ou `/senateurs`) `?search&groupe&legislature|session&page&limit=24` ; `/deputes/groupes` ; `/deputes/legislatures` ; `/senateurs/sessions` | Mêmes routes, plus `sort` et `order` (`params.ts`, `listeQueryOf`). Les groupes sont bornés à la période choisie (`groupesQueryOf`) | Le nouveau corrige le filtre des groupes au Sénat (session « 2024-2025 » envoyée en « 2024 ») |
| Filtres | Recherche (debounce 300 ms), groupe (masqué hors période courante), législature ou session (masquée s'il n'y en a qu'une) | Recherche (300 ms), groupe (toujours visible, borné à la période), période, **tri** (nom, prénom, présence, loyauté, amendements, interventions) | Nouveau : le tri. Non vérifié : que l'API trie bien `/deputes?sort=presence` |
| Pagination | Défilement infini. `?page=N` rendu côté serveur, avec une pagination en liens sous la liste | Pagination en liens, `?page=N`, 404 au-delà de la dernière page | Plus accessible. Anciens liens `?page=` compatibles |
| Paramètres d'URL | `search`, `groupe`, `legislature` / `session`, `page`, `compare=<slug>` | Mêmes clés, plus `tri`. `compare=a,b` porte toute la sélection | Compatible, sauf `?compare=true` (voir plus bas) |
| Comparaison | « Mode comparaison » à activer, sélection gardée dans un état local, `?compare=<slug>` présélectionne | Case « Comparer » sur chaque carte, sélection dans l'URL, barre `ComparisonBar` (`SelectionComparaison.tsx`) | Mieux : la sélection survit au changement de page et de filtre |
| `?compare=true` | Le menu d'`apps/web` (« Comparer des députés » → `/deputes?compare=true`) ouvre le mode comparaison | `slugsDe` lit `true` comme un slug : la barre affiche un élu « true » | Les anciens liens partagés cassent |
| Carte | Photo, nom, groupe (pastille), circonscription | `ParlementaireCard` : mêmes champs, plus la chambre | À parité |
| Accessibilité | Pas de libellé sur les `<select>` | `NativeSelect` avec libellé, `role="status"` sur le nombre de résultats, `EmptyState` avec action | Mieux |

À faire
- P2 : traiter `?compare=true` (et toute valeur qui n'est pas un slug) comme « pas de sélection », dans `slugsDe` (`packages/screens/src/parlementaires-liste/params.ts`).
- P3 : remettre un lien « Voir les archives » vers la période précédente.
- P3 : vérifier que `/deputes` et `/senateurs` acceptent `sort=presence|loyaute|amendements|interventions` (non vérifié côté API pour ces routes).

---

### /deputes/[slug] et /senateurs/[slug] (fiches)

Ancien : `apps/web/app/deputes/[slug]/page.tsx`, `apps/web/app/deputes/[slug]/PageClient.tsx`, `apps/web/app/senateurs/[slug]/page.tsx`, `apps/web/app/senateurs/[slug]/PageClient.tsx`, `apps/web/app/senateurs/[slug]/FicheEluProvisoire.tsx`, `apps/web/components/parlementaire/{stats-parlementaire,titres-fiche,bilan-poste,mandats-timeline,interventions-list,filtre-chambre}.tsx`, `apps/web/lib/{presence,fonctions-en-vue,gouvernements,use-onglet-ancre}.ts` · Nouveau : `apps/site/app/{deputes,senateurs}/[slug]/page.tsx`, `apps/site/app/_parlementaires/{chargement.ts,json-ld.ts}`, `packages/screens/src/parlementaire-fiche/*`

**Verdict : Parité partielle.** La structure est reprise et plus propre, mais les ajouts de master manquent tous.

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Ordre des blocs | Fil d'Ariane → identité (photo, nom, **titres**, groupe, circonscription, profession, naissance, liens, source) → [Sénat : bandeau « siège remis en jeu »] → statistiques → **mandats (frise)** → encart « Comparer / Situer dans le classement » → synthèse IA → **déclarations HATVP** → encart « Soutenir » → onglets votes / interventions / amendements | Fil d'Ariane → identité (plus lieu de naissance, commission permanente, série, Facebook pour tous) + bouton « Comparer » → statistiques → synthèse IA → onglets votes / amendements / interventions / **mandats** / **déclarations** | Mandats et HATVP passent dans des onglets : ils ne sont plus visibles à l'arrivée |
| Titres sous le nom (master) | `TitresFiche` + `titresDeLaFiche` : poste au Gouvernement en cours (lien vers `/gouvernements/<slug>`), présidence de l'assemblée, d'une commission ou d'un groupe, « depuis le … » (`titres-fiche.tsx`, `fonctions-en-vue.ts`) | Absent. `FicheEnTete.tsx` n'a pas de titres. Le type `ParlementaireDetail` n'a pas `fonctionsGouvernementales` | **Régression** : la fiche d'un Premier ministre ou du président du Sénat ne le dit pas (#118) |
| Titre `<title>` | « Nom, Premier ministre, député — votes et activité » quand une fonction gouvernementale est en cours (`page.tsx`, `fonctionEnCours`) | « Nom, député — votes et activité » (`meta.ts`, `metaFiche`) | Perte de la fonction au Gouvernement dans le titre et la description |
| Statistiques, présence | `CartePresence` : à l'AN, présence aux solennels en tête et « X % tous scrutins » dessous. Au Sénat, « Participation » si pas de solennel. Président d'assemblée : « Ne vote pas » + « X % hors présidence ». `null` → « Non mesurable ». Moins de 50 scrutins → « sur N scrutins seulement » (`stats-parlementaire.tsx`) | Une carte « Présence » = `stats.presence` (tous scrutins), solennel en détail (`FicheStatistiques.tsx`). Pas de cas président, pas de cas Sénat, pas de seuil | **Régression #108** : un sénateur affiche sa participation par groupe comme une présence (souvent 100 %). Un président d'assemblée affiche « — » sans explication |
| Statistiques, période | Infobulle : chiffres sur toute la carrière ; les classements comparent le mandat en cours | Pas d'explication de période. Mention « calculée » + date du calcul (`statsCalculatedAt`) | Explication de master absente. Provenance mieux signalée dans le nouveau |
| Autres cartes | Loyauté (« — aucun vote à comparer »), votes, interventions, questions | Loyauté, votes, interventions, **amendements déposés (adoptés)**, questions | Nouveau : la carte amendements |
| Mandats | `MandatsBlock` : frise des législatures ou mandatures, fonctions rattachées, **fonctions gouvernementales** avec **bilan par poste** (`BilanPosteLigne`, appel `/gouvernements/membres/:slug`) | Onglet « Mandats » : `MandatsTimeline`, fonctions rattachées (`OngletMandats.tsx`). Pas de fonctions gouvernementales ni de bilan | **Régression master** : postes ministériels et leur bilan absents |
| Synthèse IA | « Fiche parlementaire », « Généré par IA », date, lien `/methodologie#enrichissement-ia` | « Synthèse », `ProvenanceLabel provenance="ia"`, date, même lien (`FicheResumeIA.tsx`) | À parité, mieux signalée |
| HATVP | Section, 4 premières puis « Voir N de plus », lien externe | Onglet « Déclarations HATVP » (si présentes), toutes visibles, mention de source officielle | À parité, moins visible |
| Onglet Votes | `/…/votes?page&limit=20&dissidentOnly&dateFrom&dateTo&chambre` ; défilement infini ; filtre de période, **filtre de chambre** (élu passé par les deux chambres), bouton « Votes dissidents » ; tags du scrutin | `votesQueryOf` : mêmes paramètres sauf `chambre` ; pagination ; période ; case « votes différents du groupe » ; n° de scrutin, statut | Perte du filtre de chambre et des tags. Libellé du filtre plus neutre (bien) |
| Onglet Amendements | `/…/amendements?votedOnly&dateFrom&dateTo&chambre`, `ExpandableAmendementCard` avec **liens Légifrance dans le dispositif** (`renvois`, master a1676e3) | `amendementsQueryOf` sans `chambre` ; `AmendementCard`, sans `renvois` (aucune occurrence dans `packages/ui/src/parliament/amendement-card/` ni dans `packages/data`) | Perte du filtre de chambre et des liens Légifrance |
| Onglet Interventions | `/…/interventions?limit=10&type&chambre` ; **filtre par type** (interventions, questions, réponses du Gouvernement, explications de vote, interruptions) ; séances repliables ; **lien vers la page de séance** `/reunions/<seanceId>` (`interventions-list.tsx` l. 170-219) | `interventionsQueryOf` : période seulement ; lien externe « Compte rendu intégral » (`OngletInterventions.tsx`) | Perte du filtre par type, du filtre de chambre et du lien interne vers la séance |
| Onglet dans l'URL | Ancre : `#votes`, `#interventions`, `#amendements` (`use-onglet-ancre.ts`, master a14e21f) | Paramètre `?onglet=…&page=…&dateFrom&dateTo&dissidents=1&votesPublics=1` (`params.ts`) | **Anciens liens à ancre non repris** : `#interventions` ouvre l'onglet Votes. `dateFrom`/`dateTo` compatibles |
| Liens sortants | « Comparer » (`/deputes?compare=<slug>`) **et « Situer dans le classement »** (`/classements?tab=parlementaires&chambre=…&highlight=<slug>`) (`FicheCompareCallout.tsx`) | Bouton « Comparer » seulement | Perte du lien vers le classement |
| Slug inconnu | 404 ; député passé au Sénat : 308 ; Sénat → AN : 307 ; **élu du 27/09 sans fiche : fiche provisoire** (`/senatoriales/2026/elus/:slug`, `FicheEluProvisoire.tsx`) | 404 et redirections identiques (`chargement.ts`, `chargerFicheOu404`). Pas de fiche provisoire | Perte faible depuis le 1er octobre (non vérifié : reste-t-il des élus sans fiche ?) |
| Bandeau « siège remis en jeu » | `SiegeRenouvelableCallout` (série 2) | Absent | Il se retire seul après la prise de fonction : sans effet aujourd'hui (non vérifié) |
| SEO | `PersonJsonLd` + `BreadcrumbJsonLd`, sans `jobTitle` pour un ancien élu ; `sameAs` (X, site, Facebook au Sénat) | `jsonLdFiche` (`parlementaireJsonLd`) | Détail du JSON-LD non comparé ligne à ligne |
| Accessibilité | Boutons d'onglets sans rôle ARIA | `Tabs` de `@clair/ui`, `h1` unique, contacts en liste nommée, avatar décoratif | Mieux |

À faire
- P1 : appliquer la règle #108 à la carte de présence. Porter `CartePresence` (`apps/web/components/parlementaire/stats-parlementaire.tsx`) dans `FicheStatistiques.tsx` : solennel en tête, « Participation » au Sénat sans solennel, « Ne vote pas » / « hors présidence » pour un président, « Non mesurable » pour `null`, mention « sur N scrutins seulement ». Typer `presence` et `loyaute` en `number | null` et ajouter `scrutins` dans `StatsParlementaireDetail`.
- P1 : titres sous le nom. Ajouter `fonctionsGouvernementales` au type, porter `fonctionsEnVue`, `fonctionEnCours` et `titresDeLaFiche` dans `FicheEnTete.tsx`, et dans `metaFiche` (titre et description).
- P2 : reprendre les ancres `#votes`, `#interventions`, `#amendements` (lecture du `hash` au montage, puis bascule sur `?onglet=`).
- P2 : postes ministériels et bilan par poste dans l'onglet Mandats (`MandatsTimeline` + équivalent de `BilanPosteLigne`, appel `/gouvernements/membres/:slug`).
- P2 : filtre par type dans l'onglet Interventions (`type=`), et lien vers `/reunions/<seanceId>`.
- P2 : liens Légifrance du dispositif (`renvois`) dans `AmendementCard`, à typer dans `AmendementParlementaire`.
- P2 : expliquer la période des chiffres (carrière ici, mandat en cours dans les classements).
- P3 : filtre de chambre sur les trois listes, pour un élu passé par les deux chambres (`chambre=`).
- P3 : lien « Situer dans le classement » ; tags du scrutin dans l'onglet Votes ; encart « Soutenir » ; fiche provisoire des élus du 27/09 si le cas existe encore.
- P3 : réfléchir à remonter Mandats et HATVP hors des onglets (ils étaient visibles sans clic).

---

### Images Open Graph des fiches

Ancien : `apps/web/app/deputes/[slug]/opengraph-image.tsx`, `apps/web/app/senateurs/[slug]/opengraph-image.tsx` · Nouveau : `apps/site/app/{deputes,senateurs}/[slug]/opengraph-image.tsx`, `apps/site/app/_parlementaires/image-partage.tsx`

**Verdict : Parité partielle.**

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Contenu | Photo, nom, groupe, circonscription, 3 chiffres | Idem, plus « Ancien / Ancienne » pour un mandat terminé, et une image de rubrique si l'API est en panne | Mieux sur ces deux points |
| Présence Sénat | « Présence (solennels) » sinon « Participation » (master) | « Présence » = `stats.presence` | **Règle #108 non appliquée** |
| Valeur nulle | `pourcent()` gère `null` | `` `${stats.presence} %` `` : affiche « null % » si l'API renvoie `null` (président, membre du Gouvernement) | Bogue |
| Élu provisoire | Image dédiée (élection du 27/09) | 404 | Perte faible |

À faire
- P2 : gérer `null` (« — » ou « Ne vote pas ») et appliquer la règle #108 dans `image-partage.tsx`.

---

### /deputes/comparer et /senateurs/comparer

Ancien : `apps/web/app/{deputes,senateurs}/comparer/page.tsx`, `apps/web/components/comparison/{ComparisonStatsGrid,ComparisonVotesTable,ComparisonAmendements}.tsx` · Nouveau : `apps/site/app/{deputes,senateurs}/comparer/page.tsx`, `packages/screens/src/comparateur/*`

**Verdict : Parité partielle.**

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| URL | `?slugs=a,b` | `?slugs=a,b` + `divergents=1` | Compatible. Données chargées côté serveur, page en `noindex` |
| Profils | Cartes avec bouton retirer, carte « Ajouter » | `ParlementaireCard` sélectionnées (décocher = retirer), bouton « Ajouter », ordre de l'URL gardé | À parité |
| Statistiques | Grille avec mise en couleur du meilleur et du pire (vert, orange). Au Sénat (master) : « Participation » + « Présence solennelle » toujours affichée | `DataTable` sans couleur de jugement (choix apartisan, mieux), provenance « calculée ». « Présence » = tous scrutins ; ligne solennelle masquée si toutes les valeurs sont nulles | **Règle #108 non appliquée** au Sénat |
| Votes comparés | `/…/:slug/votes?limit=100` par élu, scrutins communs, filtre « divergents » (état local) | Même calcul, filtre dans l'URL | À parité, mieux |
| Amendements | `ComparisonAmendements` : déposés, adoptés, taux d'adoption, derniers amendements par élu avec « Voir plus » | Absent | **Bloc perdu** |
| Signal de retour | `signalStrongAction()` (widget de retour) | Absent (aucune occurrence dans `packages/` ni `apps/site`) | Perte mineure |

À faire
- P1 : règle #108 dans `StatsComparees.tsx` (libellé « Participation » au Sénat, ligne solennelle toujours affichée au Sénat). Corriger le commentaire « n'existe qu'à l'Assemblée ».
- P2 : reprendre le bloc amendements (déposés, adoptés, derniers amendements de chaque élu).
- P3 : signal du widget de retour sur une comparaison aboutie.

---

### /groupes (liste)

Ancien : `apps/web/app/groupes/page.tsx`, `apps/web/app/groupes/PageClient.tsx` · Nouveau : `apps/site/app/groupes/page.tsx`, `packages/screens/src/groupes-liste/*`

**Verdict : À parité.**

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| API | `/parlementaires/groupes`, ou `/deputes/groupes`, `/senateurs/groupes` avec `legislature` / `session` ; `/deputes/legislatures` ; `/scrutins/periodes?chambre=senat` | Mêmes routes (`params.ts`, `groupesEndpointOf`) | À parité |
| URL | `search`, `chambre`, `legislature`, `session` | Mêmes clés | Compatible |
| Blocs | Par chambre : hémicycle, sélecteur de période, « Voir tous les députés », cartes (logo, nom, membres, position déclarée, badge de chambre) | `SectionChambre` : hémicycle cliquable, période, lien vers la liste, cartes (pastille, membres, position) ; tri par position | Logo du groupe absent des cartes |
| Liens | `/groupes/<chambre>/<slug>?legislature=…` ou `?session=…` | Idem | À parité |

À faire
- P3 : logo du groupe (`logoUrl`) sur les cartes.

---

### /groupes/[chambre]/[slug] (fiche de groupe)

Ancien : `apps/web/app/groupes/[chambre]/[slug]/page.tsx`, `apps/web/app/groupes/[chambre]/[slug]/PageClient.tsx` · Nouveau : `apps/site/app/groupes/[chambre]/[slug]/page.tsx`, `packages/screens/src/groupe-fiche/*`

**Verdict : Parité partielle.**

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| API | `/groupes/:chambre/:slug?legislature&session`, `/…/votes?groupeInitie&legislature&session`, `/…/alliances?legislature`, `/…/thematiques?legislature` | Mêmes appels (`VotesGroupe.tsx`, `AlliancesGroupe.tsx`, `ThematiquesGroupe.tsx`) | À parité |
| URL | `legislature`, `session` ; filtre « initié » et tri des membres en état local | Mêmes clés + `initie=1`, `tri`, `ordre` | Mieux (partageable) |
| En-tête | Logo, nom, législature ou session (« composition d'époque »), position déclarée | Idem (`EnTeteGroupe.tsx`) | À parité |
| Chiffres | Membres actifs + rang ; présence (master : au Sénat « Présence » solennelle ou « Participation » si pas de solennel) ; loyauté ; amendements | Idem, mais sans solennel le libellé est « Présence moyenne » quelle que soit la chambre (`ChiffresGroupe.tsx`) ; provenance « calculée » | **Règle #108 incomplète** au Sénat |
| Votes | Camembert pour/contre/abstention, cohésion, scrutins récents avec cohésion | Graphique, cohésion, scrutins | À parité (graphiques non comparés en détail) |
| Alliances, thématiques | Cartes alliés (> 60 %) / opposés (< 40 %), radar ; masqués pour une session passée du Sénat | « Proximité de vote », graphique de cohésion par thème ; même masquage | À parité, vocabulaire plus neutre |
| Membres | Cartes avec photo, tri nom / présence / loyauté. Master : au Sénat, présence = `statsPresenceSolennel` | Tableau triable ; présence = `statsPresence` pour les deux chambres. `GroupeMembre` n'a pas `statsPresenceSolennel` (`packages/data/src/groupes.ts:11`) | **Règle #108 non appliquée** aux membres du Sénat |
| Liens sortants | Encart « Situer dans le classement » | Lien « Situer ce groupe dans le classement des groupes » | À parité |
| Image OG | Membres, présence moyenne, loyauté | Idem | À parité (règle #108 absente des deux côtés) |

À faire
- P1 : règle #108 sur la liste des membres du Sénat (ajouter `statsPresenceSolennel` au type, colonne et tri) et sur la carte de présence (« Participation » au Sénat sans solennel).
- P3 : présence solennelle dans l'image OG d'un groupe du Sénat (absente aussi de l'ancien).

---

### /classements

Ancien : `apps/web/app/classements/page.tsx`, `apps/web/app/classements/PageClient.tsx`, `apps/web/components/classements/{ClassementsTable,TopFlopCards}.tsx`, `apps/web/lib/presence.ts` · Nouveau : `apps/site/app/classements/page.tsx`, `packages/screens/src/classements/*`

**Verdict : Parité partielle.**

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| URL | `tab`, `chambre`, `sort`, `order`, `periode`, `groupe`, `page`, `highlight`, `rank` | Mêmes clés + `groupeSort` (`params.ts`) | Compatible |
| API | `/parlementaires?chambre&sort&order&periode&groupe&page&limit=50`, flop `order=asc&limit=5`, `/parlementaires/:slug/rank`, `/…/historique-carriere`, groupes du filtre, `/groupes?chambre` | Mêmes appels (`OngletParlementaires.tsx`, `OngletGroupes.tsx`) | À parité |
| Valeur de présence | `presenceDe(chambre, stats)` : sénateurs = `presenceSolennel` (master) | `stats.presence` pour tous (`valeur()`, l. 71). Or l'API **trie** les sénateurs sur `statsPresenceSolennel` (`apps/api/src/modules/parlementaires/parlementaires.service.ts` ~l. 270) | **Le tri et le chiffre affiché ne concordent pas** au Sénat, dans le tableau comme dans le top / flop |
| Non classés (master) | « n.c. » au lieu du rang quand `classable === false` (moins de 50 scrutins), sauf présence au Sénat | Absent : `classable` et `scrutins` non typés dans `StatsParlementaire` | **Régression** : un élu sur 28 scrutins reçoit un rang |
| Note sous le tableau | Sénateurs classés aux solennels (`PRESENCE_SENAT_EXPLICATION`) ; période (mandat ou carrière) expliquée | Aucune note | Régression master |
| Top / flop | `TopFlopCards` avec partage | `TopFlop`, provenance « calculée », sans couleur de jugement ; bouton de partage de page | Partage par carte non vérifié |
| Groupes | Présence moyenne (Sénat : solennelle), loyauté, cohésion, membres | Tri présence, loyauté, cohésion, membres ; présence Sénat non vérifiée dans `OngletGroupes.tsx` | À vérifier |
| Image OG | `/api/og?type=classement|classement-parlementaire|classement-groupes&sort&chambre&slug&rank` | Aucune : `apps/site/app/api` n'a que `v1`. Titres et descriptions repris (`page.tsx`) | **Image de partage perdue** |
| Accessibilité | Table HTML | `DataTable` avec légende, `aria-live`, « Mis en avant » en badge texte | Mieux |

À faire
- P1 : règle #108 au Sénat (afficher `presenceSolennel` dans le tableau et le top / flop, comme le tri de l'API) ; typer `presenceSolennel`, `scrutins` et `classable` dans `StatsParlementaire` (`packages/data/src/parlementaires.ts`).
- P1 : « n.c. » pour les lignes non classables, et la note qui explique le Sénat et la période.
- P2 : image OG dynamique des classements (route `opengraph-image` ou équivalent de `/api/og`).
- P3 : vérifier la présence des groupes du Sénat dans `OngletGroupes.tsx` (`statsPresenceSolennelMoyenne`).

---

### /gouvernements (liste)

Ancien : `apps/web/app/gouvernements/page.tsx`, `apps/web/components/gouvernements/portrait.tsx`, `apps/web/lib/gouvernements.ts` · Nouveau : aucun fichier

**Verdict : Absent du nouveau front.**

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Données | `/gouvernements` → `{ data: GouvernementResume[], source }` (rendu serveur, `revalidate` 1 h) | Rien. Aucun type dans `packages/data` | À créer |
| Blocs | Titre, « N gouvernements depuis 2007 », note de source (open data AN, dates du JO) ; sections par présidence ; carte par gouvernement : portrait et lien vers la fiche du PM, dates, barre de durée relative à la présidence (avec légende), membres et part de femmes, « N recours au 49.3, N motions de censure » (depuis juin 2017), badge « En fonction » | — | À porter |
| SEO | `BreadcrumbJsonLd`, canonique, entrée dans `apps/web/app/sitemap.ts` (l. 184-340) | Ni route, ni sitemap | À porter |
| Navigation | Menu « Qui décide » (master) avec « Gouvernements » | `apps/site/lib/site-config.ts` garde l'ancien menu (« Parlementaires », « Activité ») | Menu par rôle absent |

À faire
- P1 : écran `gouvernements-liste` (types `GouvernementResume`, `SourceGouvernements` dans `packages/data/src/gouvernements.ts`), route `apps/site/app/gouvernements/page.tsx`, entrée dans le sitemap.
- P2 : menu par rôle de master dans `site-config.ts` (« Qui décide », « Lois et votes », « Élections », « Outils »). Ses liens « Comparer » pointent déjà vers `/deputes/comparer`, ce qui évite le piège `?compare=true`.

---

### /gouvernements/[slug] (fiche d'un gouvernement)

Ancien : `apps/web/app/gouvernements/[slug]/page.tsx`, `apps/web/components/gouvernements/{composition-gouvernement,bilan-gouvernement,onglets,portrait}.tsx`, `apps/web/lib/gouvernements.ts` · Nouveau : aucun fichier

**Verdict : Absent du nouveau front.**

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Données | `/gouvernements/:slug` → `{ data: GouvernementDetail, domaines, source, sourceBilan }` ; `/gouvernements/membres/:slug` (bilan par poste, depuis les fiches) | Rien | À créer |
| En-tête | « Gouvernement X », « En fonction », dates, présidence | — | À porter |
| Colonne de faits (fixe) | PM (portrait, lien vers la fiche), durée, membres, femmes, changements de composition ; bilan : textes portés, dont promulgués, ratifications, recours au 49.3, motions (adoptées en rouge), liens vers les onglets ; « pas de données avant juin 2017 » ; gouvernement précédent / suivant | — | À porter |
| Onglets (ancre `#composition`, `#textes`, `#censure`, `#postes`) | Composition et remaniements (frise d'étapes, entrées / départs / changements, regroupement par domaine) ; Textes portés (par domaine du chef de file, stades) ; 49.3 et censure (engagements, motions liées, motions spontanées, liens vers les scrutins) ; Tous les postes (par rang, dates, identifiant `PM…`) | — | À porter |
| Provenance | Source AN + source du bilan (DOSLEG Sénat) ; dit que le classement par domaine est celui de CLAIR (donnée calculée) | — | À porter tel quel (officiel vs calculé) |
| Accessibilité | Frise en `<ol>` avec `aria-pressed`, couleurs + signes (+, −, ↔) | — | À garder : jamais la couleur seule |
| Image OG | Aucune (image par défaut) | — | — |

À faire
- P1 : écran `gouvernement-fiche` et route `apps/site/app/gouvernements/[slug]/page.tsx` : types (`GouvernementDetail`, `PosteMinisteriel`, `BilanGouvernement`, `MotionCensure`, `ProjetLoi`, `Domaine`), helpers purs de `lib/gouvernements.ts` (`etapes`, `duree`, `RANGS`, `libellePoste`, `lienFiche`…) à mettre dans `packages/screens` avec leurs tests, onglets dans l'URL, `BreadcrumbJsonLd`, métadonnées.
- P2 : bilan par poste sur les fiches de parlementaires (voir plus haut) et le bloc `ContexteGouvernemental` des scrutins, dossiers et sujets (hors de ce périmètre : à voir avec ces écrans).
- P3 : image OG d'un gouvernement (l'ancien n'en a pas).

---

### Récapitulatif des P1

1. **Règle #108 (présence des sénateurs)** absente du nouveau front. À corriger dans la carte de présence de la fiche (`FicheStatistiques.tsx`), le comparateur (`StatsComparees.tsx`), la fiche de groupe (membres et carte de présence) et les classements (tableau et top / flop, aujourd'hui triés sur une valeur et affichés sur une autre). Les types de `packages/data` sont à corriger d'abord (`presence` et `loyaute` nullables ; `presenceSolennel`, `scrutins` et `classable` à ajouter).
2. **Cas du président d'assemblée** (« Ne vote pas », « hors présidence ») et de la présence non mesurable, sur la fiche.
3. **Titres sous le nom** (fonction au Gouvernement en cours, présidences) et fonction gouvernementale dans le `<title>` des fiches.
4. **Classements** : « n.c. » sous 50 scrutins, et note qui explique le Sénat et la période.
5. **/gouvernements** et **/gouvernements/[slug]** à porter (types, écrans, routes, sitemap).

## Votes, textes, recherche

Audit en lecture seule, fait sur la branche `feature/ui-mantine` après fusion de `master`. Les ajouts de `master` (commits `161602f`, `5617c2f`, `a14e21f`, `32fc197`, `a1676e3`) ont été relus avec `git diff ca23987 upstream/master`.

Constat transversal : **aucun des ajouts récents de `master` n'est dans le nouveau front.** Aucune occurrence de `censure`, `gouvernement`, `motionCensure`, `renvois` ou `ContexteGouvernemental` dans `packages/screens/src/{scrutins-liste,scrutin-fiche,dossiers-liste,dossier-fiche,sujet-fiche}` ni dans `packages/data/src`. Les types `ScrutinDetail`, `DossierDetail`, `SujetDetail` et l'amendement de `packages/data` n'ont pas non plus ces champs. Les bandeaux de `apps/web` renvoient vers `/gouvernements/...`, qui n'existe pas dans `apps/site/app` : c'est un prérequis hors de ce périmètre.

---

### /scrutins

Ancien : `apps/web/app/scrutins/page.tsx`, `apps/web/app/scrutins/PageClient.tsx`, `apps/web/components/scrutins/ScrutinListCard.tsx` · Nouveau : `apps/site/app/scrutins/page.tsx`, `packages/screens/src/scrutins-liste/{ScrutinsListeScreen.tsx,params.ts}`, `packages/ui` `ScrutinCard`

Verdict : **Parité partielle**

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| En-tête | Titre, total, sources AN/Sénat, liens Comprendre, Guide et Archives (`/votes`) | Les mêmes, plus un fil d'Ariane | À parité |
| Dossiers en cours | `/dossiers/trending?limit=6`, défilement horizontal | Même appel, `DossierCard` en liste | À parité |
| Recherche | `search` | `search`, saisie retardée de 300 ms | À parité |
| Filtre chambre | `<select>` | `ChambreSwitch` | À parité |
| Filtre mode (`type`) | solennel, ordinaire, motion | Les mêmes | À parité |
| Filtre objet (`nature`) | `NATURES_FILTRABLES` | Les mêmes six valeurs | À parité |
| **Filtre motions de censure (`censure`)** | `toutes`, `alinea3` (49.3), `alinea2` (`PageClient.tsx` l. 319-334, ajouté par `master`) | **Absent** de `params.ts` et de l'écran | **Régression.** Un lien `?censure=alinea3` affiche tous les scrutins sans prévenir |
| Thématique (`tag`) | `/scrutins/tags` | Même appel. Une valeur inconnue reste choisie | À parité |
| Période | `DateRangePicker`, législatures et sessions via `/scrutins/periodes`. Choisir une période règle aussi la chambre | Le même, plus des raccourcis génériques | À parité |
| Filtres actifs | Un compteur et « Effacer » | Une puce par filtre, retirable | Le nouveau fait mieux |
| Pagination | Défilement infini côté client, `?page=` rendue côté serveur avec des liens `Pagination` | Liens `?page=` seulement, 20 par page | Les anciens liens restent valides. Comportement différent mais plus accessible |
| Carte scrutin | Numéro, chambre, importance, date, mode, **thématiques**, barre de votes, résultat | Sans les thématiques (`ScrutinCard.tsx`) | Thématiques perdues sur la carte |
| État vide | Aucun | `EmptyState` avec « Effacer les filtres » | Le nouveau fait mieux |
| Image OG | `opengraph-image.tsx` (badge Scrutins) | `opengraph-image.tsx` (`imageRubrique`) | À parité |

À faire :
- P1 : ajouter le filtre `censure` (`toutes|alinea2|alinea3`) dans `scrutins-liste/params.ts`, `scrutinsQueryOf` et la barre de filtres, avec sa puce de filtre actif. L'API l'accepte déjà (`scrutins.controller.ts` l. 145).
- P3 : afficher les thématiques sur `ScrutinCard`, ou acter qu'on les retire.

---

### /scrutins/[numero] (onglets Amendements, Débats, Vote)

Ancien : `apps/web/app/scrutins/[numero]/{page.tsx,PageClient.tsx,og/route.tsx}`, `components/{scrutin-sidebar,scrutin-votes-tab,scrutin-debats-tab,scrutin-amendements-tab,scrutin-dossier-banner}.tsx`, `apps/web/components/TexteAmendement.tsx`, `apps/web/lib/{texte-amendement,use-onglet-ancre}.ts` · Nouveau : `apps/site/app/scrutins/[numero]/page.tsx`, `packages/screens/src/scrutin-fiche/{ScrutinFicheScreen,ScrutinInfos,DossierBandeau,AmendementsOnglet,DebatsOnglet,VotesOnglet,Intervention}.tsx`, `params.ts`, `packages/ui/src/parliament/amendement-card/AmendementCard.tsx`

Verdict : **Parité partielle**

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Ordre des blocs | Fil d'Ariane, titre, **bandeau motion de censure**, bandeau dossier, résumé IA, colonne latérale et onglets, appel « Soutenir » | Fil d'Ariane, titre et badges (numéro, chambre, période, résultat), bandeau dossier, résumé IA, colonne latérale et onglets | Bandeau de censure absent, appel « Soutenir » absent |
| **Bandeau motion de censure** | `MotionCensureBandeau` sur `scrutin.motionCensure` (gouvernement visé, 49.3, majorité requise) | Absent, et le champ manque dans `ScrutinDetail` (`packages/data/src/scrutin-detail.ts`) | **Régression** (ajout de `master`) |
| Bandeau dossier | État, numéro de loi, nombre d'amendements, sources AN/Sénat/Légifrance | Le même contenu (`DossierBandeau.tsx`) | À parité |
| Résumé IA | « En clair » et lien « Résumé généré par IA » | `ProvenanceLabel provenance="ia"`, texte repliable | À parité, en mieux |
| Colonne latérale | Date (lien vers la séance), chambre, demandeurs **avec liens vers groupes et députés** (`formatDemandeurs`), mode, badge « Important », résultat, thématiques, source | Date et séance, chambre et période, demandeurs **en texte brut**, mode, badge « Important · calculé par CLAIR », **objet du vote**, résultat, thématiques, lien « Comprendre », source | Demandeurs sans liens. Le nouveau indique la provenance et ajoute l'objet du vote |
| État de l'onglet dans l'URL | **Ancre** `#amendements`, `#debats`, `#vote` (`useOngletAncre`, ajouté par `master`) | `?onglet=amendements` | **Anciens liens partagés avec une ancre ignorés** : l'onglet par défaut s'affiche |
| Onglet Amendements : texte | Dispositif rendu par `TexteAmendement`, **renvois Légifrance cliquables** (`renvois`). Exposé des motifs | `AmendementCard` : dispositif et exposé réduits à du texte (`texteDe`), **sans aucun lien Légifrance** | **Régression** (ajout de `master`) |
| Onglet Amendements : auteurs | « par X et N cosignataires », liste complète une fois déplié | `auteurLibelle` en entier (jusqu'à environ 70 noms) | Lisibilité moindre |
| Onglet Amendements : défense | Bloc « Défendu en séance » avec boutons « Lire le débat de ce vote » et « Voir dans la séance » | Bloc « Défendu en séance » (`Intervention`), sans ces deux liens | Liens de navigation perdus |
| Onglet Amendements : sous-amendements | `DiscussionsEtSousAmendements` | Mention « Sous-amendement à … » avec lien | Non vérifié en détail : la liste des discussions et des sous-amendements enfants semble absente |
| Onglet Débats | `/scrutins/:n/interventions`, défilement infini, tri, recherche et nature (explications de vote d'abord) gardés en mémoire seulement, message de rattachement | Même appel, `?nature`, `?ordre`, `?q`, `?page` dans l'URL, explications de vote d'abord, même message de rattachement, « Défense de l'amendement n° … » | Le nouveau fait mieux (état partageable) |
| Onglet Vote | Barre colorée, puces pour/contre/abstention/non-votants, groupes en barres cliquables (le clic filtre), élus **avec photo**, filtre de groupe en mémoire | `ResultatVote`, mention « Donnée officielle », tableau triable par groupe avec lien vers le groupe à la période, élus filtrables (`?groupe`, `?position`), badge de groupe et de position, **sans photo** | Plus accessible et partageable. Photos perdues. Aucun hémicycle, ni d'un côté ni de l'autre |
| JSON-LD | `VoteEventJsonLd` et fil d'Ariane | `scrutinJsonLd` et `filArianeJsonLd` | À parité. Le contenu de `scrutinJsonLd` n'a pas été comparé champ par champ |
| Canonique | `/scrutins/n?chambre&session` | `scrutinHref(scrutin)`, même logique | À parité |
| **Image OG** | Carte propre au scrutin (`/scrutins/[n]/og?chambre&session&v=`) : titre, barre de votes, résultat | **Aucune image propre** : pas d'`opengraph-image` ni de route `og` sous `apps/site/app/scrutins/[numero]`. Les métadonnées annoncent `summary_large_image` sans image | **Régression** : un vote partagé n'a plus sa carte. Il faut vérifier si l'image de rubrique `/scrutins/opengraph-image.tsx` est héritée |
| Introuvable | Bloc « Scrutin non trouvé » | `notFound()` côté serveur, `EmptyState` côté client | Le nouveau fait mieux |

À faire :
- P1 : créer `apps/site/app/scrutins/[numero]/opengraph-image.tsx`, ou une route `og`, qui reprend la carte de l'ancien (titre, barre, résultat), avec chambre et session pour lever l'ambiguïté du numéro.
- P1 : ajouter `motionCensure` au type `ScrutinDetail` et un bandeau de motion de censure avant le bandeau dossier.
- P1 : afficher les renvois Légifrance du dispositif. Il faut ajouter `renvois` au type de l'amendement et à `AmendementCard`, puis porter `segmenterTexteAmendement`, avec le lien accessible « (Légifrance, nouvel onglet) ».
- P2 : accepter l'ancre `#vote`, `#debats` ou `#amendements` à l'arrivée et la convertir en `?onglet=`, pour que les liens déjà partagés restent valides.
- P3 : liens vers groupes et députés dans « Vote demandé par ». Résumé « X et N cosignataires ». Liens « Lire le débat » et « Voir dans la séance » sous la défense. Photos des élus. Appel « Soutenir » (à arbitrer).

---

### /votes

Ancien : `apps/web/app/votes/page.tsx` · Nouveau : `apps/site/app/votes/page.tsx`, `packages/screens/src/votes-archives/VotesArchivesScreen.tsx`

Verdict : **À parité**

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Données | `/scrutins/annees` (cache d'un jour) | `/scrutins/annees` (cache d'une heure, `connection()`) | À parité |
| Contenu | Fil d'Ariane, titre, lien vers `/scrutins`, grille des années avec leur nombre de scrutins | Le même | À parité |
| SEO | Canonique, OG, Twitter, JSON-LD fil d'Ariane | Canonique, OG, JSON-LD. Pas de bloc `twitter` | Écart mineur |
| Image OG | Aucune | Aucune | À parité |

À faire :
- P3 : ajouter `twitter: { card: "summary_large_image" }` si on veut garder la même carte.

### /votes/[year]

Ancien : `apps/web/app/votes/[year]/page.tsx`, `apps/web/lib/scrutins-archive.ts` · Nouveau : `apps/site/app/votes/[year]/page.tsx`, `votes-archives/{params.ts,VotesArchivesScreen.tsx}`

Verdict : **À parité**

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Validation | Année à 4 chiffres, entre 2006 et l'année en cours, sinon 404 | `parseAnnee`, mêmes bornes | À parité |
| Données | `/scrutins?dateFrom&dateTo&limit=50&page` | `archivesQueryOf`, même requête | À parité |
| Contenu | Total, liens vers les 12 mois, liste, pagination, lien d'exploration | Le même. Le total passe sous les mois | À parité |
| URL, SEO | `?page=`, canonique, `noindex,follow` dès la page 2, page hors limites en 404 | Le même | À parité |

À faire : rien de bloquant.

### /votes/[year]/[month]

Ancien : `apps/web/app/votes/[year]/[month]/page.tsx` · Nouveau : `apps/site/app/votes/[year]/[month]/page.tsx`

Verdict : **À parité**

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Validation | Mois sur 2 chiffres, de 01 à 12. Mois vide ou page hors limites en 404 | Le même | À parité |
| Navigation | Mois précédent et suivant, bornés à 2006 et au mois en cours, plus des liens vers l'année et vers `/scrutins` | `moisVoisins`, même règle, mêmes liens | À parité |
| JSON-LD | 4 niveaux | 4 niveaux | À parité |

À faire : rien.

---

### /dossiers

Ancien : `apps/web/app/dossiers/{page.tsx,PageClient.tsx}` · Nouveau : `apps/site/app/dossiers/page.tsx`, `packages/screens/src/dossiers-liste/{DossiersListeScreen.tsx,params.ts}`

Verdict : **Parité partielle**

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| En-tête | Total, sources, lien Comprendre | Le même, plus un fil d'Ariane | À parité |
| Recherche, chambre | `search`, `chambre` | Les mêmes | À parité |
| État (`etat`) | 7 valeurs, dont caduc, fusionné et retiré | 4 valeurs, celles qu'accepte l'API (`dossiers.schema.ts` l. 7) | Le nouveau est plus juste : les 3 autres valeurs étaient refusées par l'API |
| **Origine du texte (`gouvernement`)** | `projets` ou `49-3` (ajouté par `master`, `PageClient.tsx` l. 197-211) | **Absent** de `params.ts` et de l'écran | **Régression.** Un lien `?gouvernement=49-3` est ignoré sans prévenir |
| Procédure | `procedureLibelle` via `/dossiers/filters` | Le même. `procedureCode` lu dans l'URL et affiché en puce | À parité |
| Période | `dateFrom`, `dateTo` (« Période ») | Les mêmes, libellé « Date de dépôt » | À parité, plus clair |
| Pagination | Défilement infini, `?page=` côté serveur | Liens `?page=` | À parité |
| Carte | `DossierCard` (scrutins, amendements) | `DossierCard` avec chambre, date de dépôt, dernier vote, numéro de loi | À parité ou mieux |
| Image OG | `opengraph-image.tsx` | `opengraph-image.tsx` | À parité |

À faire :
- P1 : ajouter le filtre `gouvernement` (`projets` / `49-3`) dans `dossiers-liste/params.ts`, `dossiersQueryOf`, `aDesFiltres`, l'écran et les puces.

---

### /dossiers/[uid]

Ancien : `apps/web/app/dossiers/[uid]/{page.tsx,PageClient.tsx,opengraph-image.tsx}`, `apps/web/components/ExpandableAmendementCard.tsx` · Nouveau : `apps/site/app/dossiers/[uid]/{page.tsx,opengraph-image.tsx}`, `packages/screens/src/dossier-fiche/{DossierFicheScreen,DossierContexte,ParcoursDossier,AmendementsDossier,ScrutinsDossier}.tsx`, `params.ts`

Verdict : **Parité partielle**

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| En-tête | Chambre, état, procédure, titre, date de dépôt, lien AN **ou** Sénat selon la chambre, bouton « Voir l'analyse complète du sujet » | Les mêmes, liens AN **et** Sénat quand ils existent | À parité |
| Commissions saisies | Fond ou avis, lien, chambre | Le même (`DossierContexte.tsx`) | À parité |
| **Contexte gouvernemental** | `ContexteGouvernementalBandeau` (projet du Gouvernement, signataires, 49.3, motions) sur `dossier.gouvernement` | **Absent**, et le champ manque dans `DossierDetail` | **Régression** (ajout de `master`) |
| Résumé IA | « En clair » et mention IA | `ProvenanceLabel ia` | À parité |
| Chiffres | 4 tuiles et une **barre adoptés/rejetés** | 4 `StatCard`, sans barre | Barre perdue (redondante) |
| Loi promulguée, loi appliquée, travaux d'application | Oui | Oui | À parité |
| Onglets | Parcours, Amendements, Scrutins. `?tab=` **et** ancre `#parcours`, `#amendements`, `#scrutins` (ajouté par `master`) | `?tab=` seulement | Les liens avec ancre ne sont pas repris |
| Parcours | `/dossiers/:uid/chronologie`, `ParcoursParlementaire` | Même appel, `ParcoursDossier` | À parité (rendu non comparé visuellement) |
| Amendements : filtres | « Votes publics » (en mémoire), `?groupe`, `?sort`, amendement épinglé `?amendement=` | `?voted=true`, `?groupe`, `?sort`, `?amendement=`, pagination `?page` | Le nouveau fait mieux (tout dans l'URL). Les anciens liens `?groupe=&tab=amendements` restent valides |
| **Amendements : texte** | `ExpandableAmendementCard` et `TexteAmendement` : **renvois Légifrance** dans le dispositif | `AmendementCard` : texte brut, sans renvoi | **Régression** (ajout de `master`) |
| Scrutins : filtre objet | Puces avec décompte (`naturesCount` de l'API) | `NativeSelect` avec décompte, `?nature`, pagination `?page` | À parité, état partageable |
| Image OG | Titre, chambre, procédure, état, décomptes | Mêmes champs, état écrit en toutes lettres | À parité |
| JSON-LD | Fil d'Ariane | Fil d'Ariane | À parité |

À faire :
- P1 : ajouter `gouvernement` à `DossierDetail` et un bandeau « Le Gouvernement et ce texte ». Ses liens vers `/gouvernements/...` supposent que cette page existe dans le nouveau front.
- P1 : renvois Légifrance dans le dispositif des amendements (même chantier que sur la fiche scrutin, dans `AmendementCard`).
- P2 : lire l'ancre `#parcours`, `#amendements` ou `#scrutins` à l'arrivée.
- P3 : barre adoptés/rejetés (à arbitrer).

---

### /sujets

Ancien : `apps/web/app/sujets/{page.tsx,PageClient.tsx}` · Nouveau : `apps/site/app/sujets/page.tsx`, `packages/screens/src/sujets-liste/{SujetsListeScreen,SujetsSections,SujetCard}.tsx`, `sections.ts`

Verdict : **À parité**

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Données | `/sujets` par lots de 100 (côté serveur, puis client) | Même découpage, chargement en chaîne (`ChargeurSujets`, 20 pages au plus) | À parité |
| Sections | À la une, récemment promulgués, en discussion, promulgués, rejetés, caducs et retirés | Mêmes règles (`sections.ts`), plus « Voir plus » au-delà de 12 | À parité |
| Recherche | `?search=` | `?search=` | À parité |
| Image OG | Aucune image propre | Aucune image propre | À parité |

À faire : rien.

---

### /sujets/[slug]

Ancien : `apps/web/app/sujets/[slug]/{page.tsx,PageClient.tsx,opengraph-image.tsx}` · Nouveau : `apps/site/app/sujets/[slug]/{page.tsx,opengraph-image.tsx}`, `packages/screens/src/sujet-fiche/*`

Verdict : **Parité partielle**

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| En-tête | Statut, titre, dates clés | Statut, catégorie, description, dates | À parité |
| **Contexte gouvernemental** | `ContexteGouvernementalBandeau` sur `sujet.gouvernement` (ajouté par `master`) | **Absent**, et le champ manque dans `SujetDetail` | **Régression** |
| Parcours | Frise et séances du sujet (`/sujets/:slug/chronologie`) | `ParcoursSujet`, même appel | À parité |
| Contexte (résumé IA, loi) | Oui, avec mention IA | `ContexteSujet` avec `ProvenanceLabel ia` | À parité |
| Ressources | Documents officiels, pour comprendre, presse (`/presse`). Onglets sur mobile | Une carte par famille | À parité |
| Dossiers et documents liés | `/sujets/:slug/dossiers?limit=50`, `/documents-lies` | Les mêmes | À parité |
| Stats par groupe | `/stats`, tri et chambre en mémoire, lien `?groupe=&tab=amendements`, descriptions IA signalées | Les mêmes, plus `?groupes` et `?tri` dans l'URL, `ProvenanceLabel calculee` et `ia` | Le nouveau fait mieux |
| Scrutins du sujet | `/sujets/:slug/scrutins`, chambre et objet en mémoire | Même appel, `?chambre`, `?nature`, `?page` | Le nouveau fait mieux |
| Image OG | label, catégorie, description, décomptes | Les mêmes champs | À parité |

À faire :
- P1 : ajouter `gouvernement` à `SujetDetail` et le bandeau de contexte gouvernemental (même composant que pour le dossier).

---

### /explorateur

Ancien : `apps/web/app/explorateur/page.tsx` (`notFound()`) · Nouveau : `apps/site/app/explorateur/page.tsx` (`notFound()`)

Verdict : **À parité** (page désactivée des deux côtés)

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Rendu | 404 | 404 | À parité |
| Sitemap | `apps/web/app/sitemap.ts` l. 350 liste encore `/explorateur`, qui répond 404 | Non vérifié dans `apps/site/app/sitemap.ts` | À vérifier |

À faire :
- P3 : ne pas reprendre `/explorateur` dans le sitemap du nouveau site.

---

### /recherche

Ancien : `apps/web/app/recherche/page.tsx` (`'use client'`) · Nouveau : `apps/site/app/recherche/page.tsx`, `packages/screens/src/recherche/{RechercheScreen,ResultatCard}.tsx`, `params.ts`, `resultats.ts`

Verdict : **Le nouveau fait mieux**

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Rendu | Tout côté client, sans métadonnées propres | Résultats rendus côté serveur (`/search`), titre, description, canonique | Mieux |
| URL | `?q=`, `?anciens=1`. **Le type choisi n'est pas dans l'URL** | `?q=`, `?type=`, `?anciens=1` | Mieux, et compatible avec les anciens liens |
| Catégories | 8, dans l'ordre de `SECTION_ORDER` | Les mêmes 8, dans le même ordre | À parité |
| Anciens élus | Bascule, « N résultats archivés correspondent aussi », libellé du mandat clos | `Switch`, même lien, même libellé (`libelleAncien`) | À parité |
| Pagination d'une catégorie | Défilement infini, 30 par page | Bouton « Afficher plus », 30 par page | Plus accessible |
| Accessibilité | Puces sans `aria-pressed` | `fieldset` avec légende, `aria-pressed`, `aria-live` | Mieux |

À faire : rien de bloquant.

---

### Récapitulatif des P1 (bloquants pour la bascule)

1. **/scrutins** : filtre « Motions de censure » (`?censure=toutes|alinea2|alinea3`), dans `packages/screens/src/scrutins-liste/params.ts` et l'écran.
2. **/scrutins/[numero]** : image Open Graph propre au scrutin (titre, barre de votes, résultat). Aujourd'hui il n'y en a aucune sous `apps/site/app/scrutins/[numero]`.
3. **/scrutins/[numero]** : bandeau de motion de censure (`motionCensure`), à ajouter au type `ScrutinDetail` et à l'écran.
4. **/scrutins/[numero]** et **/dossiers/[uid]** : renvois Légifrance dans le dispositif des amendements (`renvois` dans `packages/data` et `AmendementCard`, rendu en texte, jamais en HTML).
5. **/dossiers** : filtre « Origine du texte » (`?gouvernement=projets|49-3`).
6. **/dossiers/[uid]** et **/sujets/[slug]** : bandeau « Le Gouvernement et ce texte » (`gouvernement` dans `DossierDetail` et `SujetDetail`). Il dépend de pages `/gouvernements` dans le nouveau front, hors de ce périmètre.

Points non vérifiés : rendu visuel (aucune capture faite), contenu exact de `scrutinJsonLd`, héritage de l'image OG de rubrique par `/scrutins/[numero]`, sitemap du nouveau site.

## Travaux, lobbying, sénatoriales 2026

Audit en lecture seule, fait le 14/11/2026 sur la branche `feature/ui-mantine`, en comparant avec `upstream/master`. Pour chaque écran, j'ai lu le code de l'ancien front (`apps/web`) et celui du nouveau (`apps/site` et `packages/screens`). Je n'ai rien vérifié dans un navigateur.

### /commissions

Ancien : `apps/web/app/commissions/page.tsx`, `apps/web/app/commissions/PageClient.tsx` · Nouveau : `apps/site/app/commissions/page.tsx`, `packages/screens/src/commissions-liste/CommissionsListeScreen.tsx`, `params.ts`, `libelles.ts`

Verdict : **Le nouveau fait mieux**

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Blocs | Titre, nombre, source (AN seule), filtres, sections par type (`TYPE_ORDER`), cartes | Fil d'Ariane, chapeau, sources AN **et** Sénat, filtres, compte `aria-live`, sections par type (`COMMISSION_TYPES`), cartes | Le nouveau cite aussi data.senat.fr |
| Données | `GET /api/v1/commissions?actif=true&limit=500`, rendu côté serveur | Même appel, rendu côté serveur (`fetchListe`) | Aucun |
| Carte | Nom, chambre, **`nomCourt` en police à chasse fixe**, membres, réunions, « Depuis », « Inactive » | Nom, chambre, membres, réunions, « Depuis », badge « Inactive » | `nomCourt` n'est plus affiché. Ce champ est souvent un code (« CION-SOC »), comme le note `apps/web/app/reunions/[uid]/page.tsx` l. 32-36 : son retrait peut être voulu |
| État d'URL | `chambre`, `type`, `historique=1`. La recherche reste en mémoire | Mêmes clés, plus `search` (avec un délai de 300 ms) | Les anciens liens marchent. La recherche se partage désormais |
| Filtre de type | `select` avec 11 types | `NativeSelect` sur `COMMISSION_TYPES`, avec un libellé visible | Mieux pour l'accessibilité (libellé de champ) |
| Liste vide | Texte seul | `EmptyState` avec « Effacer les filtres » | Mieux |

À faire
- **P3** Décider si le `nomCourt` revient sur la carte, ou s'il n'apparaît que lorsqu'il n'est pas un code.

### /commissions/[slug]

Ancien : `apps/web/app/commissions/[slug]/page.tsx`, `PageClient.tsx` (972 lignes), `apps/web/lib/use-onglet-ancre.ts` · Nouveau : `apps/site/app/commissions/[slug]/page.tsx`, `packages/screens/src/commission-fiche/CommissionFicheScreen.tsx`, `MembresCommission.tsx`, `ReunionCommission.tsx`, `OrdreDuJour.tsx`, `HistoriqueReunions.tsx`, `DossiersCommission.tsx`, `params.ts`

Verdict : **Parité partielle** (contenu complet ; l'ajout de master sur les onglets n'est pas reporté)

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| En-tête | Nom, chambre, type, membres, réunions, textes examinés | Les mêmes, plus la date de début, la présidence (lien vers la fiche) et la source selon la chambre | Mieux |
| Onglets | Membres, Agenda, Historique (« Séances passées » pour l'hémicycle), « Textes & Rapports ». Hémicycle : ni membres ni textes, onglet par défaut « historique » | Mêmes onglets, mêmes règles (`params.ts` l. 64-86) | Aucun |
| Membres | Triés par qualité, anciens membres repliables | Pareil, avec `aria-expanded` et `aria-controls`, et des membres dédoublonnés (`membresUniques`) | Mieux. Le nombre de membres peut différer de `nbMembres` (il est dédoublonné) |
| Ordre du jour | 3 points puis « + N autres points » | 3 points puis « Voir les N autres points », `aria-expanded` | Aucun |
| Carte d'une réunion | Date, heure, ordre du jour, lieu, vidéo, compte rendu, participants, scrutins par dossier | Les mêmes, plus « Annulée » quand `etat === "annule"` | Mieux |
| Historique | `GET /api/v1/commissions/:slug/reunions?passees=true&limit=20`, défilement infini | Même appel, pagination par liens (`?page=`) | Change : pagination au lieu du défilement, mais l'adresse garde la page |
| Textes | `GET /api/v1/commissions/:slug/dossiers` avec `role`, `etat` et la période. Filtres en mémoire, défilement infini | Même appel. Filtres dans l'URL (`role`, `etat`, `dateFrom`, `dateTo`, `page`), pagination | Mieux (on peut partager la vue) |
| Onglet dans l'URL (**master a14e21f**) | `#historique`, `#membres`, `#agenda`, `#dossiers` via `useOngletAncre`. La barre d'onglets défile à l'écran | `?tab=historique` (`params.ts` l. 37). `packages/ui/src/layout/tabs/Tabs.tsx` ne lit pas l'ancre | **Non reporté.** Un lien `…/commissions/x#historique` ouvre l'onglet Membres dans le nouveau front |
| Direct | Aucun sur cette page | Aucun | Aucun |
| Image Open Graph | Aucune | Aucune | Aucun |

À faire
- **P2** Lire l'ancre `#membres|#agenda|#historique|#dossiers` à l'arrivée et la traduire en `tab`, pour que les liens partagés depuis le 11/11 (master a14e21f) marchent encore. Même besoin pour les fiches de députés et de sénateurs, hors de ce périmètre.
- **P3** Faire défiler jusqu'à la barre d'onglets quand l'URL en désigne un, comme `useOngletAncre`.

### /reunions/[uid]

Ancien : `apps/web/app/reunions/[uid]/page.tsx`, `PageClient.tsx`, `DebatDeReunion.tsx`, `SommaireDeSeance.tsx`, `apps/web/lib/seance-url.ts` · Nouveau : `apps/site/app/reunions/[uid]/page.tsx`, `packages/screens/src/reunion/ReunionScreen.tsx`, `DebatDeReunion.tsx`, `PriseDeParole.tsx`, `SommaireDeSeance.tsx`, `ResultatDuVote.tsx`, `debat.ts`, `params.ts`

Verdict : **À parité** (le nouveau fait un peu mieux sur l'URL et la provenance)

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Ordre des blocs | Bouton Retour + fil, en-tête (chambre, titre, date, lieu, participants, vidéo, compte rendu), ordre du jour, encadré du vote suivi, sommaire, débat, avis sur les amendements, participants | Même ordre. Fil d'Ariane du `PageHeader`, sans bouton Retour. Mention de source finale « (donnée officielle) » | Bouton Retour retiré (le fil d'Ariane suffit). La provenance est désormais explicite |
| Données | `GET /api/v1/agenda/:uid`, puis `/agenda/:uid/debat?page&limit=50` (200 en arrivant d'un vote) | `GET /api/v1/agenda/:uid`, puis `/agenda/:uid/debat?page&limit=200` | Pages plus grosses, toujours 200 prises par page |
| Débat | Défilement infini, passages par sujet, votes à leur place, `ExpandableText` (suite chargée à la demande) | Pages numérotées (`?debat=`), mêmes passages, votes à leur place, suite chargée à la demande (`PriseDeParole.tsx` l. 27) | Pagination au lieu du défilement continu. C'est un choix : l'ancien commentaire jugeait la pagination « cassante » pour la lecture |
| Arrivée depuis un vote (`?vote=&rang=`) | Mêmes clés. **Master 5e0630f** : attendre la première page avant de défiler | Mêmes clés. La page se déduit du rang (`pageDuRang`) et le défilement attend les prises (`DebatDeReunion.tsx` l. 43-49) | **Correctif de master couvert** par construction. Le nouveau ajoute l'ancre `#prise-<rang>` |
| Sommaire | Bouton qui fait dérouler le débat (`onAllerAuDebat`) | Liens `?debat=N#prise-R` | Mieux (vrais liens) |
| Avis sur les amendements | Tableau, avis coloré selon le sens (favorable, défavorable, autre), texte toujours présent | `DataTable` avec légende cachée, `rowHeader`, badge neutre | La couleur du sens est perdue. Le texte suffit (la couleur seule ne portait rien) |
| Métadonnées, JSON-LD | Titre (organe + 1er point + jour), description, canonique vers `seanceCanonique`, fil d'Ariane JSON-LD | Identiques (`apps/site/app/reunions/[uid]/page.tsx` l. 63-99) | Aucun |
| Image Open Graph | Aucune | Aucune | Aucun |

À faire
- **P3** Rendre une couleur, avec un pictogramme, au sens de l'avis (favorable ou défavorable), en plus du texte.

### /agenda

Ancien : `apps/web/app/agenda/page.tsx`, `PageClient.tsx`, `components/MonthCalendar.tsx`, `DayDetail.tsx`, `ReunionCard.tsx`, `EvenementCard.tsx`, `apps/web/hooks/useLiveNow.ts`, `apps/web/lib/live-url.ts` · Nouveau : `apps/site/app/agenda/page.tsx`, `packages/screens/src/agenda/AgendaScreen.tsx`, `CalendrierDuMois.tsx`, `DetailDuJour.tsx`, `evenements.ts`, `params.ts`, `packages/ui/src/parliament/evenement-card/EvenementCard.tsx`

Verdict : **Parité partielle** (le direct a disparu)

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Rendu | Tout côté client (squelette au chargement) | Mois rendu côté serveur, « aujourd'hui » fixé à l'heure de Paris | Mieux (SEO, pas d'écart serveur/client) |
| Données | `GET /api/v1/agenda?dateFrom&dateTo&chambre&type&limit=1000` | Même appel (`agendaQueryOf`) | Aucun |
| Blocs | En-tête collant, filtres, calendrier collant + détail du jour (événements, puis réunions) | En-tête, sources (AN, Sénat, « Comprendre »), filtres, calendrier (avec légende et périodes en cours), détail du jour | Mieux (légende, sources) |
| État d'URL | `date`, `chambre`, `type`. Le mois sans jour est perdu au rechargement | `date`, `mois`, `chambre`, `type` | Anciens liens compatibles. Le mois se partage désormais |
| Ancre `#event-<id>` | `DayDetail.tsx` l. 39-44 fait défiler jusqu'à la carte. L'ancien accueil y renvoie (`apps/web/app/page.tsx` l. 236 : `/agenda?date=…#event-<id>`) | Aucun `id` sur les cartes (`DetailDuJour.tsx`) | **Perdu.** Un ancien lien ouvre le bon jour, sans défiler jusqu'à la réunion |
| « En cours » | Carte mise en avant pendant la réunion (fenêtre début → fin, ou 4 h). L'heure se met à jour chaque minute | Rien dans `DetailDuJour`. `EvenementCard` accepte `live` mais l'écran ne le passe pas | **Perdu** sur l'agenda. L'accueil du nouveau front garde un badge « En cours » (`ProchainementAuParlement.tsx` l. 75) |
| « En direct » (lien vidéo) | Pastille rouge vers la vidéo en direct de l'AN ou du Sénat, via `/api/live-now` (rafraîchie toutes les 5 min) | Absent. `EvenementCard` accepte `liveHref`, mais rien ne le fournit | **Perdu** (voir `/api/live-now`) |
| Carte d'une réunion | Lien étalé vers la réunion. Ordre du jour réduit à 2 lignes, à déplier (état gardé en `sessionStorage`). Scrutins seulement une fois dépliée | `EvenementCard` (titre en lien), ordre du jour en points, participants, vidéo, compte rendu, scrutins toujours visibles | Plus long à lire les jours chargés, mais rien n'est caché |
| Événements institutionnels | Carte avec type, date (le mois seul si la date n'est pas précise), sources | Même chose. S'y ajoute un lien vers une page dédiée (sénatoriales) via `pageDedieePour` | Mieux |
| Accessibilité | Boutons de mois avec `aria-label`, jours avec `aria-label` | Sections nommées, liste « Réunions du jour », légende textuelle | À vérifier au clavier dans un navigateur (non fait) |
| Image Open Graph | Badge « Agenda », vert `#10b981` | `imageRubrique` avec le même titre et le même sous-titre (`OG_COULEURS.agenda`) | À parité |
| Description Open Graph | « … en temps réel » | « … » sans « temps réel » | Cohérent avec la perte du direct |

À faire
- **P2** Rétablir le direct sur l'agenda : calculer `live` (`isHappeningNow`) et passer `liveHref` à `EvenementCard` depuis `DetailDuJour.tsx`, avec une source de liens directs (voir `/api/live-now`).
- **P3** Poser `id="event-<id>"` sur chaque réunion et défiler jusqu'à l'ancre, pour les anciens liens de l'accueil.
- **P3** Ordre du jour et scrutins dépliables, pour les jours de séance chargés.

### /api/live-now (route de l'ancien front)

Ancien : `apps/web/app/api/live-now/route.ts`, `apps/web/hooks/useLiveNow.ts`, `apps/web/lib/live-url.ts` · Nouveau : aucun fichier (`apps/site/app/api/` ne contient que le proxy `v1/[...path]`)

Verdict : **Absent du nouveau front**

À quoi elle sert : elle dit quelles retransmissions vidéo sont en direct **aujourd'hui**. La route interroge à la volée :
- `videos.assemblee-nationale.fr/php/eventsearch.php`, en JSON, pour les séances publiques et les commissions. Une table fixe de 15 codes vidéo la relie aux `organeRef` (`PO59046`…) ;
- la page HTML `videos.senat.fr/direct`, en grattant les `card-live`, pour les séances publiques du Sénat.

Elle renvoie `{ commissions: [{organeRef, directUrl, chambre}], seances: [{isoDate, order, directUrl, chambre}] }`, avec un cache CDN de 5 min (1 min en cas d'erreur).

Qui l'appelle : `useLiveNow()`, toutes les 5 min, depuis :
- l'agenda (`apps/web/app/agenda/components/DayDetail.tsx` l. 33) ;
- l'accueil (`apps/web/app/page.tsx` l. 182).

`matchLiveUrl` rapproche une réunion d'un direct de trois façons : par `organeRef`, puis par le numéro de séance tiré de `compteRenduRef` (`…N<ordre>`), puis par la date pour une séance.

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Source des directs | Route Next qui gratte les deux chambres | Rien. Pas d'endpoint dans l'API (`/api/v1`) ni dans `apps/site` | **Perdu** |
| Composant d'affichage | Pastille « En direct » dans `ReunionCard` | `EvenementCard` sait l'afficher (`live`, `liveHref` → « Suivre en direct ») | Prêt côté UI, rien ne l'alimente |
| Provenance | Liens officiels des chaînes vidéo des chambres | — | — |
| Fragilité | Grattage HTML du Sénat, table de codes fixe, `User-Agent` qui contient une adresse de contact | — | Toute reprise devrait passer par l'API (`apps/api`) plutôt que par une route du front, pour respecter la règle « données via `@clair/api-client` » |

À faire
- **P2** Décider : soit reprendre ce service dans `apps/api` (par exemple `GET /api/v1/agenda/direct`, avec un schéma Zod et un cache Redis de 5 min) et l'appeler depuis l'agenda et l'accueil, soit assumer la perte et retirer la promesse de direct. Il faut décider avant la bascule, mais rien ne casse si la fonction manque.

### /lobbying

Ancien : `apps/web/app/lobbying/page.tsx`, `PageClient.tsx`, `apps/web/components/lobbying/LobbyisteLogo.tsx` · Nouveau : `apps/site/app/lobbying/page.tsx`, `packages/screens/src/lobbying-liste/LobbyingListeScreen.tsx`, `LobbyisteItem.tsx`, `ActionLobbying.tsx`, `format.ts`, `params.ts`

Verdict : **À parité** (le nouveau fait mieux sur la pagination)

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Blocs | Titre, sources (HATVP, méthodologie, comprendre, guide), 4 chiffres, 3 dernières actions avec lien « Toutes les actions », filtres, liste | Même ordre. Chiffres en `StatCard` avec une aide sur le budget (« par tranches : un ordre de grandeur »), lien de méthodologie | Mieux (précise la nature du budget) |
| Données | `GET /api/v1/lobbying`, `/lobbying/secteurs`, `/lobbying/stats`, `/lobbying/actions/recent?limit=3` | Les mêmes quatre appels | Aucun |
| État d'URL | `search`, `type`, `secteurs` (séparés par des virgules), `sort`, `order`, `page` (rendu serveur seulement) | Mêmes clés. `page` pilote la liste | Anciens liens compatibles |
| Pagination | Défilement infini côté client, plus un composant `Pagination` serveur sous la page si `?page=` | Pagination par liens. `notFound()` au-delà de la dernière page. Titre « — page N » et canonique paginée | Mieux |
| Tri | Nom, budget, actions, chacun croissant ou décroissant | Les mêmes 6 options | Aucun |
| Logo | Favicon Google (`google.com/s2/favicons?domain=…`), tiré de `siteWeb` | `LobbyisteLogo` sans `logoUrl` : initiales | Visuel plus pauvre, mais plus aucune requête vers un tiers (Google) |
| Image Open Graph | Badge « Lobbying », titre, sous-titre | `imageRubrique` identique | À parité |

À faire
- **P3** Choisir une source de logos qui ne contacte aucun tiers (logos hébergés par CLAIR), ou garder les initiales.

### /lobbying/[id]

Ancien : `apps/web/app/lobbying/[id]/page.tsx`, `PageClient.tsx`, `opengraph-image.tsx` · Nouveau : `apps/site/app/lobbying/[id]/page.tsx`, `opengraph-image.tsx`, `packages/screens/src/lobbyiste-fiche/LobbyisteFicheScreen.tsx`, `ChiffresLobbyiste.tsx`, `ActionsLobbyiste.tsx`, `params.ts`

Verdict : **Le nouveau fait mieux**

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Blocs | Retour + fil, logo, nom, type, secteurs, SIREN, « Informations » (adresse, site), chiffres (budget, personnes, actions, ville), actions filtrables par période | Fil, en-tête, informations (adresse + code postal + ville, site, SIREN), chiffres, actions par période | Le nouveau ajoute le code postal. `siteWebHref` refuse les URL `javascript:` |
| Données | `GET /api/v1/lobbying/:id` | Même appel. Seul un UUID est accepté, sinon 404 (l'API répond 400) | Mieux (pas de 500 pour une mauvaise adresse) |
| Parlementaire rencontré | Lit `action.depute` (`PageClient.tsx` l. 71-99). L'API renvoie `parlementaire` (`apps/api/src/modules/lobbying/lobbying.controller.ts` l. 287) : **le bloc ne s'affiche jamais** | Lit `action.parlementaire` (`ActionLobbying.tsx` l. 31, 101-110) | Bug de l'ancien corrigé. Le lien pointe toujours vers `/deputes/…`, et l'API ne renvoie pas la chambre. Je n'ai pas vérifié si des sénateurs y figurent |
| Période | `dateFrom`, `dateTo` dans l'URL (`useUrlDateRange`) | Mêmes clés, comparaison au jour près, actions sans date gardées | Aucun |
| Liste vide | Texte | `EmptyState` avec « Retirer la période » | Mieux |
| Métadonnées, JSON-LD | Titre, description, `twitter`, `LobbyistJsonLd`, fil d'Ariane | Mêmes éléments (`lobbyisteJsonLd`, `filArianeJsonLd`) | Aucun |
| Image Open Graph | Nom, type, secteur, budget, actions, lobbyistes | Mêmes statistiques. Repli « Lobbying » générique si l'id n'est pas un UUID ou est introuvable | À parité, en plus robuste |

À faire
- **P3** Lien vers la fiche d'un parlementaire rencontré : demander `chambre` à l'API (`select` de `/lobbying/:id`) et passer par `parlementaireHref`, au lieu de `/deputes/…` en dur.

### /lobbying/actions

Ancien : `apps/web/app/lobbying/actions/page.tsx` (page entièrement côté client, sans métadonnées propres) · Nouveau : `apps/site/app/lobbying/actions/page.tsx`, `packages/screens/src/lobbying-actions/LobbyingActionsScreen.tsx`, `params.ts`

Verdict : **Le nouveau fait mieux**

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Rendu | `'use client'` : HTML vide de données, titre hérité | Rendu côté serveur, titre et description propres, canonique paginée, `notFound()` au-delà de la dernière page | Mieux (SEO) |
| Données | `GET /api/v1/lobbying/actions` (`search`, `cible`, `texteVise`, `secteurs`, `dateFrom`, `dateTo`, `sort`, `order`, `limit=20`), `/lobbying/secteurs` | Mêmes appels et paramètres | Aucun |
| État d'URL | `search`, `cible`, `texteVise`, `secteurs`, `sort`, `order`, `dateFrom`, `dateTo` | Mêmes clés, plus `page`. `texteVise` est validé contre la liste HATVP | Anciens liens compatibles |
| Tri | Date (récentes ou anciennes), lobbyiste (A→Z, Z→A) | Les mêmes | Aucun |
| Pagination | Défilement infini | Liens numérotés, compte `aria-live` | Mieux |
| Image Open Graph | Héritée de `/lobbying` | Héritée de `/lobbying` | À parité |

À faire
- Rien de bloquant.

### /senatoriales-2026

Ancien : `apps/web/app/senatoriales-2026/page.tsx`, `PageClient.tsx`, `components/**`, `lib/senatoriales/**`, `lib/senatoriales.ts` · Nouveau : `apps/site/app/senatoriales-2026/page.tsx`, `_chargement.ts`, `_json-ld.ts`, `ActualisationDirect.tsx`, `packages/screens/src/senatoriales/SenatorialesScreen.tsx`, `params.ts`, `composants/**`, `graphiques/**`, `resultats/**`, `lib/**`

Verdict : **Parité partielle** (portage quasi ligne à ligne, mais les libellés de présence de master manquent, et le cache edge de la page n'est pas repris).

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Ordre des blocs | Titre + compte à rebours, résultats nationaux (si scrutin commencé), « Comment fonctionne… » + sources, 3 chiffres, « Qui remet son siège en jeu ? », index des circonscriptions, répartition par groupe, carte, pastilles de lecture, filtres, graphique du tri, liste, méthode (`PageClient.tsx` l. 683-1010) | Même ordre, mêmes textes (`SenatorialesScreen.tsx` l. 269-534) | Aucun |
| Appels d'API | `/senatoriales/2026`, `/senatoriales/2026/sortants?departement&groupe&tri`, liste complète si filtre restreignant, `/senatoriales/2026/resultats` (cache 60 s) (`page.tsx` l. 51-132) | Identiques (`_chargement.ts` l. 37-61) | Aucun |
| État d'URL | `search`, `departement`, `groupe`, `tri` ; département et groupe validés par regex, tri borné à `TRIS_SORTANTS` (`page.tsx` l. 151-169) | Mêmes noms et mêmes validations (`params.ts` l. 22-38) | Anciens liens compatibles |
| Recherche | Écrit l'URL à chaque frappe | `SearchInput` avec délai de 300 ms (l. 411-417) | Mieux |
| Ancres | `#resultats`, `#<slug graphique>` (cadre), `#<département>` (sections, `ancreDepartement`) | Mêmes ancres (`BlocResultatsNationaux.tsx` l. 25, `CadreGraphique.tsx` l. 39, `lib/format.ts` l. 48) | Les `#gironde` partagés marchent |
| Graphique par tri, surbrillance depuis un graphique, défilement vers la liste | Oui (`PageClient.tsx` l. 381-651) | Oui (l. 86-204, 449-476), bandeau en `role="status"` | Aucun |
| Direct des résultats | `EnDirect` : pastille + `router.refresh()` chaque minute si l'onglet est visible (`components/resultats/EnDirect.tsx`) | Logique scindée : `ActualisationDirect.tsx` (rafraîchit) monté par la route si `directNational`, `composants/EnDirect.tsx` (pastille) | Même comportement. Scrutin passé (27/09) : sans effet aujourd'hui |
| Libellé de présence (master a30a8a7) | `SortantCard` : « Présence (solennels) » ; `DistributionBilan` : « présence aux votes solennels » | `composants/SortantCard.tsx` l. 135 : « Présence » ; `graphiques/DistributionBilan.tsx` l. 16 : « présence en séance » | **Non reporté.** L'API mesure la présence aux votes solennels (migration `carriere_presence_solennel`) : le nouveau libellé est inexact |
| Sous-titre du graphique de présence | Master : « Présence mesurée aux votes solennels… » (`lib/senatoriales/graphiques.ts` l. 44-45) | Ancien texte : « La quasi-totalité des sortants dépasse 95 % de présence… » (`lib/graphiques.ts` l. 47-48) | **Non reporté.** Ce chiffre ne vaut plus pour la nouvelle mesure. Le texte apparaît aussi dans le cadre du tri `presence` et dans la `description` de la page graphique |
| Provenance | Aucun marqueur sur les graphiques | `ProvenanceLabel provenance="calculee"` sur chaque cadre (`CadreGraphique.tsx` l. 46) | Mieux |
| Accessibilité des graphiques | SVG `role="img"`, carte cliquable à la souris | Carte avec boutons `aria-pressed`, `TableauDonnees` (tableau de repli) sous chaque graphique, libellés de filtres masqués visuellement mais présents | Mieux |
| Cache edge | `vercel.json` : `s-maxage=60, stale-while-revalidate=600` sur `/senatoriales-2026`, page en `force-dynamic` (`apps/web/vercel.json` l. 50-59) | `apps/site/vercel.json` n'a que des en-têtes de sécurité. Page en `force-dynamic` sans cache CDN | Chaque visite réveille la fonction. Écart de coût, pas de fonction |
| Péremption côté client | `staleTime` 1 h, aligné sur le serveur | `staleTime` global de 60 s (`packages/api-client/src/provider.tsx` l. 14) | Relances possibles au bout d'une minute. Mineur |
| JSON-LD | Fil d'Ariane, `Election`, FAQ | Mêmes trois blocs (`page.tsx` l. 94-104) | Aucun |

À faire
- **P1** Reporter master a30a8a7 : « Présence (solennels) » dans `packages/screens/src/senatoriales/composants/SortantCard.tsx`, « présence aux votes solennels » dans `graphiques/DistributionBilan.tsx`, puis le nouveau `sousTitre` et la nouvelle `accroche` de `presence` dans `lib/graphiques.ts`. La page affiche sinon une mesure mal nommée et une affirmation chiffrée (« dépasse 95 % ») qui ne correspond plus à la donnée.
- **P2** Reprendre l'en-tête `Vercel-CDN-Cache-Control` de `/senatoriales-2026` (`s-maxage=60`) et celui de `/senatoriales-2026/graphiques/:slug` (`s-maxage=3600`) dans `apps/site` (`vercel.json` ou `headers()`).
- **P3** Aligner le `staleTime` des requêtes de l'écran sur le cache serveur (1 h), comme l'ancien.

### /senatoriales-2026/[departement]

Ancien : `apps/web/app/senatoriales-2026/[departement]/page.tsx`, `components/resultats/BlocsCirconscription.tsx`, `EnTete.tsx`, `ListeCandidatureCard.tsx`, `SortantCard.tsx` · Nouveau : `apps/site/app/senatoriales-2026/[departement]/page.tsx`, `_chargement.ts`, `packages/screens/src/senatoriales/CirconscriptionScreen.tsx`, `resultats/BlocsCirconscription.tsx`, `resultats/Etats.tsx`

Verdict : **Parité partielle** (même contenu ; seul l'écart de présence de la carte sortant vient de la page mère).

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Blocs | Retour, H1 « Sénatoriales 2026 <locution> », chapeau selon la phase (avant, jour J, publié), état, source et avertissement ; attente des résultats ; proportionnel (liste en tête, élus, voix par liste, répartition des sièges, participation, listes et candidats) ou majoritaire (élus, tours, participation) ; déroulement du scrutin ; candidats (avant publication) ; sortants et leur sort ; lien vers les 64 ; appel au don | Même ordre, mêmes conditions (`CirconscriptionScreen.tsx` l. 100-316) ; appel au don via `EncartSoutien` | Aucun |
| Appels d'API | `/senatoriales/2026`, `/sortants?departement=&tri=nom`, `/candidats?departement=`, `/resultats/<code>` (60 s) | Identiques (`_chargement.ts` l. 41-103) ; sortants et candidats rechargeables côté client | Aucun |
| Erreurs | API muette : la page se rend sans liste ; circonscription absente : `notFound()` | `fetchResource` : une panne lève une erreur (page d'erreur, cache précédent gardé) au lieu d'un faux 404 ; `ErrorState` avec « Réessayer » pour les candidats et les sortants | Mieux |
| Direct | `EnDirect` si statut ni `pas_ouvert` ni `pourvue` et fenêtre de direct | `directCirconscription` + `ActualisationDirect` (`lib/resultats.ts` l. 131-142) | Identique |
| Pré-rendu | `generateStaticParams` sur les 64 slugs, `revalidate = 60` | `generateStaticParams = () => []` : rendu à la première visite, puis ISR 60 s | Choix assumé (build indépendant de l'API). Premier visiteur plus lent |
| Métadonnées | Titre et description selon résultats publiés ou nombre de candidats | Identiques (`page.tsx` l. 35-77) | Aucun |
| JSON-LD | Fil d'Ariane, `Election` (avec `location`), `ItemList` des sortants | Mêmes blocs (`_json-ld.ts`, `sortantsJsonLd`) | Non relu ligne à ligne : à vérifier que `affiliation` et `jobTitle` sont repris |
| Provenance | « Source : ministère de l'Intérieur », « Résultats provisoires… », note sur la nuance attribuée par l'administration | Mêmes mentions | Aucun |
| Libellé « Présence » des cartes sortants | « Présence (solennels) » | « Présence » | Voir la page mère (P1) |

À faire
- **P1** Couvert par le correctif de `SortantCard` de la page mère (même composant).
- **P3** Vérifier `sortantsJsonLd` dans `apps/site/app/senatoriales-2026/_json-ld.ts` (champs `jobTitle`, `affiliation`) contre l'ancien `ItemList`.
- **P3** Vérifier que `BlocsCirconscription.tsx` (805 lignes contre 742) reprend chaque cas : relu par ses exports et ses usages seulement, pas ligne à ligne.

### /senatoriales-2026/graphiques/[slug] (et /image)

Ancien : `apps/web/app/senatoriales-2026/graphiques/[slug]/page.tsx`, `GraphiqueClient.tsx`, `image/route.tsx`, `lib/senatoriales/og-graphiques.tsx` · Nouveau : `apps/site/app/senatoriales-2026/graphiques/[slug]/page.tsx`, `image/route.tsx`, `_og/graphiques.tsx`, `packages/screens/src/senatoriales/GraphiqueScreen.tsx`

Verdict : **Parité partielle** (fonctions identiques ; titre de présence de master non reporté).

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Blocs | Retour, pastilles « Voir aussi » (7 graphiques), cadre en `h1` avec télécharger et partager | Identique (`GraphiqueScreen.tsx` l. 112-136) | Aucun |
| Slugs | `carte`, `groupes`, `presence`, `activite`, `ages`, `commissions`, `professions` ; pré-rendus, `revalidate = 3600` | Mêmes slugs, mêmes réglages | Aucun |
| Données | `/senatoriales/2026` et `/senatoriales/2026/sortants` | Identiques, et repli client si l'API est muette au rendu | Mieux (repli) |
| Titre du graphique `presence` | Master : « Présence aux votes solennels » (`GraphiqueClient.tsx` l. 68) | « Présence en séance » (`GraphiqueScreen.tsx` l. 47) | **Non reporté** |
| `description` et `twitter` | `meta.sousTitre` | `meta.sousTitre`, donc l'ancien texte « 95 % » pour `presence` | Suit le P1 de `lib/graphiques.ts` |
| Route `/image` (PNG en pièce jointe) | `Content-Disposition` + `Vercel-CDN-Cache-Control` 1 h | Identique (`image/route.tsx`) | Aucun |
| Cache edge de la page | `vercel.json` `s-maxage=3600` | Absent ; ISR Next seul | Voir P2 de la page mère |
| Accessibilité | — | `aria-labelledby` sur les sections, tableaux de repli | Mieux |

À faire
- **P1** Titre « Présence aux votes solennels » dans `GraphiqueScreen.tsx` l. 47 (master a30a8a7).
- **P2** Cache CDN de la page (voir la page mère).

### Images Open Graph des sénatoriales

Ancien : `apps/web/app/senatoriales-2026/opengraph-image.tsx`, `[departement]/opengraph-image.tsx`, `graphiques/[slug]/opengraph-image.tsx`, `lib/og`, `lib/senatoriales/og-graphiques.tsx` · Nouveau : `apps/site/app/senatoriales-2026/opengraph-image.tsx`, `[departement]/opengraph-image.tsx`, `graphiques/[slug]/opengraph-image.tsx`, `_og/og.tsx`, `_og/graphiques.tsx`, `_og/svg.ts`

Verdict : **À parité** (sauf l'accroche de présence, qui suit `lib/graphiques.ts`).

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Image de la page mère | Badge « Élection », chiffres des candidatures si publiées, sinon repli sur 178 / 64 / 348 | Identique ; l'erreur d'API est rattrapée par un `try/catch` | Aucun |
| Image d'une circonscription | Nom, candidats, listes, sièges, mode de scrutin ; repli sans API ; pré-générée pour 64 slugs | Mêmes pastilles et même repli (`circonscriptionPourImage`) ; pas de `generateStaticParams` | Générée à la première demande d'un robot plutôt qu'au build : un premier aperçu un peu plus lent |
| Image d'un graphique | `imageGraphique(slug)`, `alt` par graphique, 7 pré-générées | Identique (`_og/graphiques.tsx`, 409 lignes contre l'ancien module) | Le PNG `presence` reprend `meta.accroche` (« par tranche de présence ») : il suit le P1 |
| Résultats dans l'aperçu | Pas de variante « résultats » dans les images (seuls les titres de métadonnées changent) | Idem | Aucun |

À faire
- **P1** Couvert par le correctif de `accroche` et `sousTitre` dans `lib/graphiques.ts` (PNG et aperçu du graphique `presence`).
- **P3** Envisager de pré-générer les 64 images de circonscription, ou de les mettre en cache longtemps, pour les premiers partages.

**Ajouts de master dans ce périmètre (a30a8a7)** : aucun des quatre changements n'est reporté dans le nouveau front.
- `SortantCard.tsx` : « Présence (solennels) ».
- `DistributionBilan.tsx` : « présence aux votes solennels ».
- `GraphiqueClient.tsx` : titre « Présence aux votes solennels ».
- `lib/senatoriales/graphiques.ts` : `sousTitre` et `accroche` de `presence`.

### Récapitulatif des P1 (bloquants pour la bascule)

- **Présence des sénateurs mal nommée (master a30a8a7 non reporté).** Il faut reporter ces changements dans le nouveau front :
  - « Présence (solennels) » dans `packages/screens/src/senatoriales/composants/SortantCard.tsx` l. 135 ;
  - « présence aux votes solennels » dans `packages/screens/src/senatoriales/graphiques/DistributionBilan.tsx` l. 16 ;
  - le titre « Présence aux votes solennels » dans `packages/screens/src/senatoriales/GraphiqueScreen.tsx` l. 47 ;
  - le nouveau `sousTitre` et la nouvelle `accroche` de `presence` dans `packages/screens/src/senatoriales/lib/graphiques.ts` l. 47-48. L'ancien texte affirme « dépasse 95 % de présence », ce qui ne correspond plus à la mesure de l'API.

  Cela touche `/senatoriales-2026`, les 64 pages de circonscription, la page du graphique `presence` et son image Open Graph.

Aucun autre P1 dans ce périmètre. Les écarts les plus lourds sont en P2 :
- le direct de l'agenda et `/api/live-now` n'ont pas d'équivalent ;
- les ancres d'onglet `#historique` des commissions (master a14e21f) ne sont pas lues ;
- le cache CDN des sénatoriales n'est pas repris dans `apps/site/vercel.json`.

## Accueil, gabarit, éditorial, SEO, proxy

Audit en lecture seule de l'arbre de travail de `feature/ui-mantine` (fusion de `upstream/master` indexée, pas encore commitée). Les textes éditoriaux ont été comparés par script : chaque phrase de plus de 25 caractères de `apps/web` a été cherchée dans `packages/screens` et `apps/site`. Les écarts listés ont été relus à la main.

### Proxy `/api/v1`
Ancien : `apps/web/app/api/v1/[...path]/route.ts`, `route.test.ts` · Nouveau : `apps/site/app/api/v1/[...path]/route.ts`, `e2e/site.fumee.spec.ts:74`

Verdict : Parité partielle (le cœur est égalé, il manque le contrôle exact du chemin et les tests unitaires)

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Liste blanche des segments | `SAFE_SEGMENT = /^[\w~-][\w.~-]*$/` (l.153) | même regex (l.30) | aucun |
| Chemins internes refusés | `homepage/warm` → 404 | idem | aucun |
| Écriture | POST seulement sur `feedback`, sinon 405 avec `Allow` | idem | aucun |
| Méthodes exportées | GET, POST, HEAD | GET, HEAD (= GET), POST | aucun |
| Garde-fou après analyse de l'URL | `target.pathname !== /api/v1/${path}` → 404 : **chemin exact** (l.184) | `!target.pathname.startsWith("/api/v1/")` (l.75) | **plus faible** : le durcissement « relaie exactement le chemin contrôlé » (commit `ac04516`) n'est pas repris. La regex couvre déjà ce cas, mais la seconde barrière manque |
| Secret interne | `x-clair-internal` si présent, journal sinon | idem | aucun |
| IP du visiteur | `request.ip`, puis `x-forwarded-for` | `x-real-ip`, puis `x-forwarded-for` | adapté à Next 16 (`request.ip` n'existe plus) ; suppose Vercel |
| En-têtes de réponse retirés | 13 en-têtes | les mêmes, plus `set-cookie` et `x-powered-by` | le nouveau fait mieux |
| Cache | `Vercel-CDN-Cache-Control` 600 s, SWR 86 400 s ; jamais avec `authorization` ou `cookie` | idem, et pas de cache si l'amont pose `set-cookie` | le nouveau fait mieux |
| Erreur de l'amont | 502 `UPSTREAM_UNREACHABLE`, non cachée | 502 `UPSTREAM_UNAVAILABLE`, non cachée | code d'erreur différent (sans effet connu) |
| Tests | 5 tests unitaires (secret, HEAD, POST feedback, 405, 404 sur chemin réservé) | 1 test e2e de fumée (200 et `x%2F..%2Fdocs` → 404) | pas de tests unitaires |

À faire
- P2 : remplacer `startsWith("/api/v1/")` par l'égalité exacte `target.pathname === "/api/v1/" + path.join("/")`, comme l'ancien.
- P2 : porter `route.test.ts` dans `apps/site` (secret, IP, 405, 404 interne, segments encodés `%2E%2E` et `.%09.`).
- P3 : aligner le code d'erreur 502 sur `UPSTREAM_UNREACHABLE`, si un client le lit.

### Blob brut des sources (`sourceData`) dans le HTML
Ancien : `apps/web/lib/api-server.ts` (`sansDonneesSource`, reviver JSON qui retire `sourceData` à **toute profondeur**, commit `ce9d67c`) · Nouveau : `apps/site/lib/api-server.ts`, `apps/site/app/_parlementaires/chargement.ts:71-79`, `apps/site/app/scrutins/[numero]/page.tsx:23-37`

Verdict : Parité partielle

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Où le champ est retiré | dans `fetchFromApi` et `fetchRessource`, pour toutes les réponses, à toute profondeur | au cas par cas, **au premier niveau seulement** : fiche parlementaire et scrutin | le reste passe |
| Fiche lobbyiste | retiré | `/lobbying/:id` renvoie le modèle `Lobbyiste` complet, `sourceData` compris (`apps/api/src/modules/lobbying/lobbying.controller.ts:277-330`). `apps/site/app/lobbying/[id]/page.tsx:67` le passe tel quel à `LobbyisteFicheScreen` (`"use client"`), donc il est **sérialisé dans le HTML** | fuite |
| Mandats d'une fiche parlementaire | retiré | `mandatsParlementaires` est chargé par `include` (`parlementaires.service.ts:587`), donc avec `MandatParlementaire.sourceData` (`schema.prisma:271`). `chargerFiche` ne retire que le champ du premier niveau | fuite probable (non mesurée sur une vraie réponse) |
| Dossier, sujet, scrutin (listes) | retiré | l'API le retire déjà (`sourceData: undefined`) | aucun |

À faire
- P1 : appliquer le même reviver dans `serverApi` (`apps/site/lib/api-server.ts`) ou dans `createHttpClient` (`@clair/api-client`), pour toutes les réponses lues côté serveur. Puis vérifier le HTML d'une fiche lobbyiste et d'une fiche de député (`grep sourceData`). Le correctif de master visait des 404 Googlebot relevés dans la Search Console et 8 à 24 Ko par fiche.

### Sitemap `/sitemap.xml`
Ancien : `apps/web/app/sitemap.ts` · Nouveau : `apps/site/app/sitemap.ts`, `packages/screens/src/seo/sitemap.ts` (`construirePlanDuSite`, testé)

Verdict : Parité partielle

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Fiches, scrutins, archives `/votes`, lobbyistes, groupes, dossiers, sujets, sénatoriales (64 départements, graphiques, élus provisoires) | oui | oui, même logique et mêmes priorités | aucun |
| Anciens parlementaires (master, `5ce2e46`) | fournis par l'API `/api/v1/sitemap`, datés par `lastModified` | même appel, même champ `lastModified` | à parité, sans changement côté front |
| `/gouvernements` et `/gouvernements/<slug>` (master) | oui (`fetchGouvernements`, l.187, 331-343) | **absent** | à reprendre, une fois la route créée |
| `/simulateur` | listé alors que la route n'existe pas (404) | absent | le nouveau fait mieux |
| Pages éditoriales (`/a-propos`, `/methodologie`, `/comprendre/*`, `/guide/*`, `/api`, `/contact`) | absentes | absentes | les deux sont incomplets |
| Échappement XML du `&` | oui | oui (`echapperUrlXml`) | aucun |
| Régénération | 24 h ; lève une erreur si l'API tombe (le dernier plan sain reste servi) | 1 h ; au build, se réduit aux pages statiques ; à la régénération, lève une erreur | choix documenté ; 24 appels de ~2,5 Mo par jour au lieu d'un |
| Adresse de base | `NEXT_PUBLIC_APP_URL` (défaut clair.vote) | `NEXT_PUBLIC_SITE_URL` (défaut **beta.clair.vote**) | à régler à la bascule |

À faire
- P1 : à la bascule, définir `NEXT_PUBLIC_SITE_URL=https://clair.vote` (variable lue au build), sinon le plan, les canoniques et le JSON-LD pointent vers la bêta.
- P2 : ajouter `/gouvernements` et chaque `/gouvernements/<slug>` à `construirePlanDuSite` (dépend de la route, absente de `apps/site/app`).
- P3 : ajouter les pages éditoriales au plan (dans les deux fronts, ou seulement dans le nouveau).

### `robots.txt` et indexation
Ancien : `apps/web/app/robots.ts` · Nouveau : `apps/site/app/robots.ts`, `apps/site/app/layout.tsx:25`, `apps/site/lib/env.ts` (`INDEXABLE`)

Verdict : Parité partielle

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Bêta | sans objet | `Disallow: /` et `noindex, nofollow` tant que `SITE_INDEXABLE` ne vaut pas `true` | bonne protection |
| Une fois indexable | `allow /`, `disallow ['/admin/', '/api/']` | `allow /` seulement | `/api/` (proxy) n'est plus exclu |

À faire
- P1 : à la bascule, mettre `SITE_INDEXABLE=true`. Sinon tout le site part en `noindex`.
- P2 : reprendre `disallow: ['/admin/', '/api/']` dans la branche indexable (la page `/api`, sans barre finale, reste indexée).

### Redirections et en-têtes (`next.config`, `vercel.json`)
Ancien : `apps/web/next.config.js`, `apps/web/lib/sujet-slug-redirects.js`, `apps/web/vercel.json` · Nouveau : `apps/site/next.config.ts`, `apps/site/lib/redirects.ts`, `apps/site/vercel.json`

Verdict : Parité partielle

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Redirections 301 | 148 sujets, 2 aperçus sénatoriales, `chistine-bost` | les 151, vérifiées une à une par script | aucun |
| En-têtes de sécurité | X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy | identiques | aucun (pas de CSP ni de HSTS des deux côtés) |
| Cache CDN des pages | `Vercel-CDN-Cache-Control` explicite par rubrique (600 s à 3 600 s, SWR 24 h) | aucun en-tête ; `export const revalidate` (ISR) par route | équivalence probable, non vérifiée sur Vercel |
| `/static/*` immuable | oui | non | sans objet si le nouveau ne sert pas `/static` (non vérifié) |
| Images distantes | 4 domaines | les 4 mêmes | aucun |

À faire
- P2 : après le premier déploiement, vérifier les en-têtes de cache réels des listes et des fiches (`x-vercel-cache`). Ajouter les règles de `vercel.json` si l'ISR ne suffit pas.

### Images Open Graph
Ancien : 14 `opengraph-image.tsx`, `apps/web/lib/og.tsx`, `apps/web/app/api/og/route.tsx` · Nouveau : les 14 mêmes, `apps/site/lib/og.tsx`, `apps/site/app/_parlementaires/image-partage.tsx`

Verdict : Parité partielle

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Fichiers par route | 14 | les 14 mêmes (liste identique) | aucun |
| Taux nul (master, `pourcent()` dans `lib/og.tsx`) | « — » quand `presence` ou `loyaute` vaut `null` | `${stats.presence} %` (`image-partage.tsx:85-86`) : affiche **« null % »** (le type `@clair/data` est bien `number \| null`) | bug |
| Présence des sénateurs (master) | « Présence (solennels) » à partir de `presenceSolennel`, sinon « Participation » | « Présence » sur le taux de tous les scrutins | méthode différente au Sénat, au rebours de la méthodologie publiée |
| Fiche provisoire d'un élu du 27 septembre | gérée (`senateurs/[slug]/opengraph-image.tsx`) | non gérée | cas devenu marginal |
| `/api/og` (images des classements partagés : `?type=classement…`) | oui, utilisé par `classements/page.tsx:49` | absent ; `classements` n'a pas d'image dédiée | les anciens liens `/api/og?…` donneront 404 |

À faire
- P1 : afficher « — » pour un taux `null` et reprendre « Présence (solennels) » pour les sénateurs (`image-partage.tsx`). Ce sont des données affichées fausses ou trompeuses.
- P3 : image dédiée aux classements (critère, rang mis en avant), ou redirection de `/api/og` vers l'image racine.

### JSON-LD
Ancien : `apps/web/components/seo/JsonLd.tsx` · Nouveau : `packages/screens/src/seo/json-ld.ts`, `apps/site/components/JsonLd.tsx`

Verdict : Le nouveau fait mieux

Organization et WebSite (avec `SearchAction`) sont repris champ pour champ. Le nouveau échappe le JSON (`serialiserJsonLd`), là où l'ancien faisait un `JSON.stringify` brut dans `<script>`.

### Plausible
Ancien : `apps/web/components/analytics/PlausibleAnalytics.tsx` · Nouveau : `apps/site/components/PlausibleAnalytics.tsx`, `apps/site/lib/env.ts`

Verdict : À parité

Mêmes variables (`NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URLS`), même double instance, `afterInteractive`. Aucun événement personnalisé d'un côté comme de l'autre.

À faire
- P1 : à la bascule, recopier ces deux variables dans le projet Vercel du nouveau site. Sans elles, aucune mesure.

### En-tête et menu
Ancien : `apps/web/components/layout/header.tsx` · Nouveau : `packages/ui/src/layout/header/Header.tsx`, `apps/site/lib/site-config.ts`

Verdict : Parité partielle

| Aspect | Ancien (après master) | Nouveau | Écart |
|---|---|---|---|
| Rubriques | par rôle : « Qui décide » (Députés, Sénateurs, **Gouvernements**, Groupes, Commissions), « Lois et votes », « Élections » (Sénatoriales 2026), Lobbying, Outils | ancienne organisation : « Parlementaires », « Activité », Lobbying, Outils | le menu par rôle de master n'est pas repris ; pas de Gouvernements |
| Libellés | « Sujets », « Agenda » | « Sujets parlementaires », « Agenda parlementaire » | anciens libellés |
| Recherche, thème, bouton « Nous soutenir », tiroir mobile | oui | oui | aucun |
| Accessibilité des menus | menu déroulant maison | motif « disclosure » du W3C, Échap, `aria-current` | le nouveau fait mieux |

À faire
- P2 : reprendre le menu par rôle de master dans `site-config.ts` (« Qui décide », « Lois et votes », « Élections »). L'entrée Gouvernements suppose que `/gouvernements` existe dans `apps/site` (aujourd'hui absente : hors de mon périmètre, mais elle bloque le menu et le sitemap).

### Pied de page
Ancien : `apps/web/components/layout/footer.tsx` · Nouveau : `apps/site/lib/site-config.ts` (`footer`), `apps/site/components/SocialIcons.tsx`

Verdict : Parité partielle

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Colonnes Explorer, Ressources, Légal, sources | oui | oui | le lien « Gouvernements » (master) manque |
| Réseaux | GitHub, X, **Discord** | GitHub, X | Discord manque |

À faire
- P2 : ajouter « Gouvernements » à la colonne Explorer (une fois la route créée).
- P3 : ajouter Discord (`https://discord.gg/pxHV4rNWck`) à `social`.

### Lien d'évitement, thème, bannières
Ancien : `apps/web/app/layout.tsx`, `components/layout/BandeauDirect.tsx` · Nouveau : `packages/ui/src/layout/app-shell/AppShell.tsx`, `packages/ui/src/core/skip-link`, `core/theme-toggle`, `layout/bandeau`

Verdict : Le nouveau fait mieux

- Lien « Aller au contenu » vers `main#contenu` : il existe dans le nouveau, **pas dans l'ancien**.
- Thème clair/sombre : `next-themes` dans l'ancien, `ColorSchemeScript` auto et `ThemeToggle` dans le nouveau.
- Le bandeau « En direct » des sénatoriales a expiré (fenêtre du 27-28/09/2026). L'emplacement `banner` existe dans `AppShell`, mais `layout.tsx` ne le passe pas. Rien à reprendre aujourd'hui.

### Accueil `/`
Ancien : `apps/web/app/page.tsx` (client, 1 033 lignes) · Nouveau : `apps/site/app/page.tsx` (rendu serveur, `revalidate = 900`), `packages/screens/src/accueil/`

Verdict : Parité partielle

| Aspect | Ancien | Nouveau | Écart |
|---|---|---|---|
| Recherche, chiffres clés, « … au total », date de mise à jour | oui | oui, avec l'étiquette de provenance « calculée » | aucun |
| Prochainement au Parlement | timeline et échéances ; lien **vidéo en direct** pour une séance en cours (`useLiveNow`, `matchLiveUrl`) | réunions et échéances ; mention « En cours » en texte, sans lien vers le direct | pas de lien vers le direct |
| Derniers dossiers, open source, usages, Comprendre, FAQ, appel au don | oui | oui ; textes repris (aucune phrase manquante, hors code) | aucun |
| Accroches des sénatoriales (`SenatorialesCallout`, `EncartResultatsSenatoriales`) | conditionnées par la date ; expirées (17/10/2026) | absentes | rien à faire |

À faire
- P3 : reprendre le lien « Regarder en direct » sur une réunion en cours (`ProchainementAuParlement.tsx`).

### Appel au don et parcours
Ancien : `apps/web/components/donations/SoutenirCallout.tsx` (fiches député, sénateur, scrutin, circonscription), `components/parcours/ParcoursParlementaire.tsx` · Nouveau : `packages/screens/src/senatoriales/composants/EncartSoutien.tsx`, `dossier-fiche/ParcoursDossier.tsx`, `sujet-fiche/ParcoursSujet.tsx`

Verdict : Parité partielle

- Parcours d'un dossier et d'un sujet : repris.
- L'encart « Soutenir » en bas des fiches député, sénateur et scrutin est **absent** du nouveau (seulement sur les sénatoriales). Le commentaire de l'ancien explique pourquoi il existe : presque tout le trafic arrive sur une fiche, et 6 visiteurs sur 1 100 atteignaient `/soutenir`.

À faire
- P2 : un composant `SoutenirCallout` dans `@clair/ui` ou `@clair/screens`, placé en pied des fiches parlementaire et scrutin.

### Formulaire de retour (feedback)
Ancien : `apps/web/components/feedback/FeedbackWidget.tsx` · Nouveau : `packages/screens/src/feedback/FeedbackWidget.tsx`, `apps/site/components/Feedback.tsx`

Verdict : À parité

Mêmes champs envoyés (`sentiment`, `type`, `message`, `email`, `page`, `trigger`, piège à robots `website`), envoyés en POST au proxy `/api/v1/feedback`. Relance (« nudge ») reprise (`relance.ts`). Focus piégé et Échap dans le nouveau.

### Partage (`ShareButton`)
Ancien : `classements/PageClient.tsx`, `senatoriales-2026/.../CadreGraphique.tsx`, `soutenir/page.tsx` · Nouveau : `packages/ui/src/layout/share-button`, utilisé dans `ClassementsScreen`, `senatoriales/composants/CadreGraphique`, `SoutenirScreen`

Verdict : À parité (mêmes trois endroits)

### Pages éditoriales : `/a-propos`, `/contact`, `/api`, `/methodologie`
Ancien : `apps/web/app/{a-propos,contact,api,methodologie}/page.tsx` · Nouveau : `packages/screens/src/{a-propos,contact,api-presentation,methodologie}/contenu.ts`, `apps/site/app/<route>/page.tsx`

Verdict : À parité

- Textes : aucune phrase manquante. L'ajout de master à `/methodologie` (« Au Sénat, les scrutins ordinaires sont votés par groupe… ») est présent.
- Métadonnées : `title` et `description` identiques. Pas de `canonical` des deux côtés.
- `/api` : exemples `curl` sur `https://api.clair.vote`. Endpoints et lien data.gouv repris.

### Pages légales : `/cgu`, `/confidentialite`, `/mentions-legales`
Ancien : `apps/web/app/{cgu,confidentialite,mentions-legales}/page.tsx` · Nouveau : `packages/screens/src/page-legale/{cgu,confidentialite,mentions-legales}.ts`

Verdict : À parité

Articles et listes identiques. Les sections « Compte utilisateur », « Simulateur » et « contenu diffamatoire » sont commentées dans l'ancien, donc à juste titre absentes du nouveau. Dates de mise à jour reprises (janvier 2026, octobre 2026, octobre 2026).

### `/soutenir`
Ancien : `apps/web/app/soutenir/page.tsx` · Nouveau : `packages/screens/src/soutenir/contenu.ts`, `SoutenirScreen.tsx`

Verdict : Parité partielle

- Formulaire HelloAsso (widget et lien), FAQ fiscale, chiffres de `/homepage` : repris.
- **Ajout de master absent** : la carte de Victor (« Architecte logiciel », texte, `public/images/victor.jpg`, commit `c9a6760`) et la grille passée à 4 colonnes. `apps/site/public/images` ne contient que `axel.jpg`, `paul.jpg`, `ruben.jpg`.

À faire
- P2 : ajouter Victor dans `contenu.ts`, copier `victor.jpg` dans `apps/site/public/images/` et adapter la grille.

### `/comprendre` et ses 7 articles
Ancien : `apps/web/app/comprendre/**/page.tsx` · Nouveau : `packages/screens/src/comprendre`, `comprendre-article/articles/*.ts`

Verdict : Parité partielle

- Six articles et l'index sont repris à l'identique, métadonnées comprises.
- `/comprendre/parlementaire` : les **ajouts de master** manquent (`comprendre-article/articles/parlementaire.ts:74-76`) :
  - la fin du bloc « Présence solennelle » (périodes au Gouvernement ou à la présidence exclues, « — » plutôt que 0 %) ;
  - le bloc « Présence au Sénat » (vote par groupe, seuls les solennels mesurent la présence) ;
  - le bloc « Fiche et classements » (carrière complète ou mandat en cours).

À faire
- P1 : reprendre ces trois textes. Ils expliquent des chiffres que le nouveau front affiche (taux « — », présence des sénateurs). Sans eux, la méthode publiée contredit l'écran.

### `/guide` et ses 5 articles
Ancien : `apps/web/app/guide/**/page.tsx` · Nouveau : `packages/screens/src/guide`, `guide-article/articles/*.ts`

Verdict : À parité

Étapes, textes, liens « Commencer → … » et métadonnées repris. Aucun changement de master dans ce périmètre.

### Pages d'erreur et 404
Ancien : `apps/web/app/not-found.tsx`, `error.tsx` · Nouveau : `apps/site/app/not-found.tsx`, `error.tsx`, `global-error.tsx`, `packages/screens/src/{not-found,error}`

Verdict : Le nouveau fait mieux

Titre « Page introuvable » en métadonnée et journalisation avec `digest`. Il ajoute une `global-error.tsx` autonome (erreur du layout racine), absente de l'ancien. `retry` est bien la prop de Next 16.4.3.

### Accessibilité et design system (synthèse)
Ancien : Tailwind, `globals.css` · Nouveau : `packages/theme/src/tokens.ts`, `contrast.ts`, `tokens.test.ts`, `packages/ui`

Verdict : Le nouveau fait mieux

Le nouveau front teste ses contrastes dans les deux thèmes (`tokens.test.ts` : texte ≥ 4,5:1, bordures et éléments graphiques ≥ 3:1, focus contre le fond). Il passe axe sur les stories (`@storybook/addon-a11y`) et dans les tests e2e (`@axe-core/playwright`, `e2e/support.ts`). Il ajoute le lien d'évitement absent de l'ancien et des menus au motif « disclosure ». Les positions de vote portent une icône et un libellé en plus de la couleur (`core/vote-position`). Il n'y a pas eu d'audit RGAA complet page par page. La pastille de couleur du groupe dans les images Open Graph (`image-partage.tsx:65-74`) est toujours accompagnée du nom du groupe.

### Récapitulatif des P1 (bloquants pour la bascule)
1. **`sourceData` encore dans le HTML** : la fiche lobbyiste en entier, les mandats des fiches parlementaires selon toute vraisemblance. Retirer le champ à toute profondeur dans `apps/site/lib/api-server.ts`, comme `sansDonneesSource` de l'ancien.
2. **Images de partage des fiches** (`apps/site/app/_parlementaires/image-partage.tsx:85-87`) : « null % » quand un taux manque, et présence des sénateurs non ramenée aux votes solennels (master).
3. **`/comprendre/parlementaire`** : reprendre les trois ajouts de master sur la présence (`comprendre-article/articles/parlementaire.ts`).
4. **Variables de bascule** à poser sur le projet Vercel du nouveau site : `SITE_INDEXABLE=true`, `NEXT_PUBLIC_SITE_URL=https://clair.vote` (lue au build), `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` et `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URLS`, `CLAIR_INTERNAL_SECRET`.

Pour mémoire, P2 à traiter avec la bascule :
- la route `/gouvernements`, absente de `apps/site`, et ce qui en dépend : menu par rôle, pied de page, sitemap ;
- Victor sur `/soutenir` ;
- l'encart « Soutenir » sur les fiches ;
- `disallow /api/` dans `robots.ts` ;
- le chemin exact et les tests unitaires du proxy.
