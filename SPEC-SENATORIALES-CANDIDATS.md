# SPEC — Candidats et résultats des sénatoriales 2026

Lot B de la page `/senatoriales-2026`, après le lot A (bilan de mandature des 178 sortants,
livré). Périmètre arrêté avec l'utilisateur le 2 septembre 2026 : **N1 + N2 + N3** ci-dessous,
et remontée des élus dès le soir du scrutin par l'open data du Sénat.

---

## 1. Le verrou calendaire

| Date | Événement | Ce qu'on peut publier |
|---|---|---|
| 7 → 11 sept. (ven. 18h) | dépôt des candidatures en préfecture | rien |
| **~18 sept.** | XLSX candidatures, ministère de l'Intérieur, data.gouv | N1 + N2 + N3 |
| 27 sept. | scrutin | élus, le soir même, via le Sénat |
| **~1er oct. (J+4)** | XLSX résultats, ministère de l'Intérieur | voix, participation, tour |
| 1er oct. | prise de fonction, bascule de mandature | automatique |

Les délais de publication ne sont pas des hypothèses, ils sont mesurés sur les éditions
précédentes :

- candidatures 2020 : publiées le **18/09/2020**, scrutin le 27 → J-9
- candidatures 2023 : publiées le **18/09/2023 à 17h28**, scrutin le 24 → J-6
- résultats 2023 : publiés le **28/09/2023 à 10h47** → **J+4**

**Conséquence : la fenêtre utile fait neuf jours et c'est le pic d'attention.** Tout le code
doit être écrit et testé sur le fichier 2023 avant le 18 septembre. Le 18, on ingère et on
publie, on ne développe pas.

Il n'existe **aucune source machine-readable entre le 11 et le ~18**. `senatoriales2026.senat.fr`
ne publie ni candidats ni résultats. Les préfectures publient l'arrêté dès le 11, en PDF, sur
64 sites hétérogènes : hors périmètre, on ne scrape pas ça pour gagner une semaine.

---

## 2. Sources

Deux producteurs, trois usages. Le Sénat ne publie **ni les candidats ni les voix** : il publie
la liste des sénateurs une fois qu'ils le sont. Il ne remplace donc qu'un maillon, celui du
soir du scrutin.

| Ce qu'on veut | Producteur | Format | Quand |
|---|---|---|---|
| candidats | ministère de l'Intérieur (data.gouv) | XLSX | ~18 sept. |
| élus | Sénat (ODSEN, annuaire) | CSV, déjà ingéré | soir du 27 |
| voix, sièges, participation | ministère de l'Intérieur (data.gouv) | XLSX | ~1er oct. |

### 2.1 Candidatures (ministère de l'Intérieur, data.gouv)

Le slug 2026 n'existe pas encore. Le découvrir par l'API data.gouv plutôt qu'à la main :

```
GET https://www.data.gouv.fr/api/1/datasets/?q=sénatoriales&page_size=30
```

Précédents, tous en XLSX :

- 2023 : `elections-senatoriales-2023-candidatures-t1`
- 2020 : `senatoriales-2020-candidatures-au-t1`
- 2017 : `elections-senatoriales-du-24-septembre-2017-liste-des-candidats`

Deux feuilles : `Scrutin proportionnel`, `Scrutin majoritaire`.

**Colonnes proportionnel (2023, 1 679 lignes / 27 circonscriptions)** : code département,
libellé département, libellé de la liste, code nuance de liste, ordre dans la liste, sexe,
nom, prénom, date de naissance, profession (code INSEE + libellé), `Sortant` (`OUI` ou vide).

**Colonnes majoritaire (2023, 150 candidats / 19 circonscriptions)** : idem, sans ordre de liste,
avec `N° dépôt` et **le suppléant** (sexe, nom, prénom, date de naissance).

### 2.2 Pièges du format, vérifiés en comparant 2020 et 2023

Le format **n'est pas stable d'une édition à l'autre**. Le parser doit donc mapper **par
libellé d'en-tête normalisé, jamais par position**, et tolérer une colonne absente.

| Piège | 2020 | 2023 |
|---|---|---|
| colonne `Sortant` | **absente** | présente (`OUI` / vide) |
| dates de naissance | série Excel (`23154`) | texte `02/11/1950` |
| ligne d'en-tête | ligne 2 (ligne 1 = titre) | ligne 1 |
| code département | `1` | `37` (zéro-paddé) |
| profession | code et libellé en 2 colonnes | une colonne `(31) - Profession libérale` |

**Lignes fantômes.** La feuille majoritaire de 2023 se termine par sept lignes réduites à une
cellule vide, artefact d'Excel. Compter les `<row>` du XML donne 157 candidats là où il y en a
**150**, et créerait sept candidatures sans nom en base. Toute ligne dont chaque cellule est
vide est écartée à la lecture (`enLignesObjets`).

Français établis hors de France : code **`ZZ`** dans le fichier, **`997`** chez nous. Table de
correspondance obligatoire, à étendre aux collectivités (`977`, `978`, `986`, `987`).

Ne jamais dépendre de `Sortant` : on recalcule le drapeau par matching (§4), et on garde les
deux pour les recouper.

### 2.3 Résultats (ministère de l'Intérieur, data.gouv, J+4)

Précédent : `elections-senatoriales-2023-resultats`. Quatre feuilles.

- `MAJ - T1`, `MAJ - T2`, `PROP` : **une ligne par circonscription**, avec des groupes de
  colonnes répétés `Nuance candidat N` / `Nom candidat N` / `Voix N` / `Elu N` / `Sièges N`.
  Format large, à dépivoter. Porte aussi **inscrits, votants, abstentions, blancs, nuls** par
  circonscription, soit la participation des grands électeurs.
- `Liste des élus` : format propre, une ligne par élu (code dept, nom, prénom, date de
  naissance, sexe, code nuance, profession, `SORTANT`, `TOUR_ELECTION`). **C'est la feuille à
  utiliser pour marquer les élus** ; les trois autres servent aux voix et à la participation.

### 2.4 Élus le soir du scrutin (Sénat)

Le ministère publie à J+4, le Sénat met à jour son annuaire et l'open data ODSEN dans les
heures qui suivent le scrutin, et **notre ingestion sait déjà les lire** (cf. la mémoire
`project_senat_anciens_source`). Le soir du 27, on marque les élus depuis le Sénat, on
enrichit avec les voix quand le XLSX tombe.

### 2.5 Référence, non ingérée

Nombre de délégués sénatoriaux par circonscription et collège électoral (93 469 grands
électeurs pour la série 2) : **hors périmètre, décision explicite**. On n'héberge pas les
profils de 90 000 personnes. On met un lien vers la ressource du Sénat, rien de plus.

Liste officielle des circonscriptions, qui a servi à valider nos chiffres (178 sièges,
64 lignes = 63 départements et collectivités + les Français de l'étranger) :
`https://www.senat.fr/fileadmin/Senateurs/Liste_circonscriptions_serie_2_elections_senatoriales_2026.pdf`

---

## 3. Modèle de données

Aucun modèle `Candidat` n'existe dans le schéma (le `/admin/candidats` mentionné dans un vieil
audit est un vestige sans table). On repart de zéro.

Pas de nouvelle entité `Election` : le scrutin est déjà décrit par
`evenements_institutionnels` (slug `senatoriales-2026`), et les candidatures sont portées par
une colonne `scrutin` textuelle.

Deux tables, parce que **l'unité de vote n'est pas la personne** : au proportionnel les voix
et les sièges vont à la liste, au majoritaire au candidat.

```prisma
/// Unité de vote : une liste au proportionnel, un binôme titulaire/suppléant au majoritaire.
model CandidatureListe {
  id                String  @id @default(uuid())
  scrutin           String  // 'senatoriales-2026'
  circonscriptionId String  @map("circonscription_id")
  modeScrutin       String  @map("mode_scrutin") // 'proportionnel' | 'majoritaire'

  numeroDepot Int?    @map("numero_depot")
  libelle     String? // libellé de liste ; null au majoritaire
  nuance      String? // code nuance préfectoral brut (LDVD, DVC…)
  famille     String? // famille politique dérivée — voir §5, N'EST PAS un groupe

  // Résultats, remplis après le scrutin
  voix        Int?
  pctExprimes Float? @map("pct_exprimes")
  sieges      Int?
  tour        Int?

  sourceUid String @unique @map("source_uid") // 'senatoriales-2026:<dept>:<numeroDepot|slug>'
  candidatures Candidature[]

  @@index([scrutin, circonscriptionId])
  @@map("candidatures_listes")
}

model Candidature {
  id      String @id @default(uuid())
  listeId String @map("liste_id")
  liste   CandidatureListe @relation(fields: [listeId], references: [id], onDelete: Cascade)

  ordre Int?   // ordre dans la liste ; 1 pour le titulaire au majoritaire
  role  String // 'titulaire' | 'suppleant'

  nom            String
  prenom         String
  sexe           String?
  anneeNaissance Int?      @map("annee_naissance") // affiché
  dateNaissance  DateTime? @map("date_naissance")  // matching uniquement, jamais exposé (§7)
  professionCode  String? @map("profession_code")
  professionLabel String? @map("profession_label")

  sortantDeclare Boolean @default(false) @map("sortant_declare") // colonne du fichier
  personneId     String? @map("personne_id")                     // résolu par matching (§4)
  personne       Parlementaire? @relation(fields: [personneId], references: [id])
  matchConfiance String? @map("match_confiance") // 'A' | 'B' — null si non rattaché

  elu  Boolean @default(false)
  voix Int?    // majoritaire uniquement

  @@index([personneId])
  @@index([listeId])
  @@map("candidatures")
}
```

`sortantDeclare` (ce que dit le fichier) et le rattachement `personneId` vers un des
178 sortants (ce qu'on calcule) sont **deux informations distinctes**. Les recouper est un
contrôle qualité, pas un détail d'implémentation : c'est ce qui détecte un mauvais matching.

---

## 4. Matching candidat ↔ parlementaire

C'est le cœur du lot. La base contient **2 133 parlementaires dont 100 % ont une date de
naissance renseignée** : la clé est donc solide et il n'y a aucune raison de faire du fuzzy.

Normalisation : NFD, suppression des diacritiques, majuscules, suppression des tirets,
apostrophes et espaces. Prénom réduit au premier token.

| Niveau | Règle | Action |
|---|---|---|
| **A** | nom + prénom + date de naissance identiques | rattachement automatique |
| **B** | nom + date de naissance identiques, prénom divergent (prénom d'usage) | rattachement automatique, marqué `B` |
| **C** | nom + prénom sans concordance de date | **pas de rattachement**, journalisé |

Aucun rattachement sur les noms seuls, jamais. La cohérence de département est un signal de
contrôle, pas une condition : un ancien député peut se présenter ailleurs.

Attendu : la quasi-totalité des candidats marqués `Sortant: OUI` doit tomber en A, et quelques
dizaines d'anciens parlementaires hors sortants doivent être découverts. Tout écart sur le
premier point est un bug de matching.

---

## 5. Nuances politiques

Le code nuance est **attribué par la préfecture**, il est régulièrement contesté, et il **n'est
pas un groupe politique**. Règles :

- table de correspondance statique versionnée dans le repo, nuance → famille politique, avec
  la liste officielle des nuances du ministère en commentaire de source ;
- gérer le préfixe `L` des nuances de liste (`LDVD` liste divers droite vs `DVD` candidat) ;
- ne jamais afficher une nuance comme le groupe du candidat, ni la comparer directement au
  groupe sénatorial d'un sortant sans le dire ;
- un sortant candidat sous une nuance éloignée de son groupe est un signal éditorial
  intéressant, à traiter avec prudence et à formuler comme tel, jamais comme un fait de
  dissidence.

---

## 6. Ce qu'on affiche

### N1 — « qui remet son siège en jeu ? »

Le plus rentable : un badge `se représente` / `ne se représente pas` sur chacune des 178 fiches
sortants existantes, plus un filtre et le compteur global. En 2023, 119 sortants sur 170 sièges
étaient candidats. Le chiffre 2026 **avec le bilan de mandature à un clic** n'existe nulle part
ailleurs. Réutilise `SortantCard` et `FilterBar` tels quels.

### N2 — le candidat qui a déjà un dossier chez nous

Les candidats rattachés par §4 à un ancien député ou sénateur portent un lien vers leur fiche
et leur historique de vote. **C'est notre exclusivité** : aucun autre site ne relie une
candidature sénatoriale à un historique de votes.

### N3 — la photographie du champ

Agrégats sur l'ensemble des candidats, avec les graphiques déjà écrits :

- concurrence par siège (candidats / sièges, par circonscription) → `CarteDepartements`
- **parité selon le mode de scrutin** : les listes sont paritaires par obligation, le scrutin
  majoritaire n'a aucune contrainte hors suppléant de sexe opposé. L'écart est mesurable et
  personne ne le publie → `BarresComptage`
- âge des candidats vs âge des sortants → `PyramideAges`
- professions et nuances → `BarresComptage`

### Priorité d'affichage

**Les 64 pages départementales avant la page mère.** La requête réellement tapée entre le 18 et
le 27 septembre, c'est « sénatoriales 2026 » suivi d'un nom de département, ces pages sont déjà
prérendues et indexées, et `modeDeScrutin()` y explique déjà la règle applicable. La page mère
prend les agrégats et la carte.

---

## 7. Données personnelles

On s'apprête à publier l'identité de ~2 000 personnes dont environ 1 850 ne seront jamais élues.
La candidature est un acte public et la source est ouverte, ce qui ne dispense pas de minimiser.

- **Publier l'âge, jamais la date de naissance.** `dateNaissance` est stockée pour le matching
  et n'est exposée par aucune route ni aucun DTO. `anneeNaissance` suffit à l'affichage.
- Pas d'indexation nominative des non-élus au-delà des pages de circonscription.
- Prévoir la mention de la source et du droit de rectification sur la page méthodologie.

---

## 8. Ingestion

### Lire du XLSX sans ajouter de dépendance

Les candidats et les voix ne sont publiés qu'en XLSX par le ministère (le Sénat, lui, ne
publie que les élus, en CSV déjà ingéré). Il faut donc savoir lire ce format, et il n'y a
aucun lecteur Excel dans le repo.

**Ne pas ajouter `exceljs` pour autant.** Un `.xlsx` est un ZIP de fichiers XML, l'ingestion
décompresse déjà des ZIP en appelant `unzip` en sous-processus
(`assemblee-nationale/client.ts:112`, `hatvp/client.ts:147`), et `xml2js` est déjà là. Un
lecteur suffit en ~80 lignes : `unzip`, puis `xl/sharedStrings.xml` et
`xl/worksheets/sheetN.xml`. Trois pièges à traiter, tous rencontrés en analysant 2020 et 2023 :

1. les chaînes sont déportées dans `sharedStrings.xml` (cellule `t="s"`, la valeur est un
   index) — prévoir aussi `t="inlineStr"` ;
2. **les cellules vides sont absentes du XML** : lire l'attribut `r` de chaque cellule
   (`B12` → colonne B) au lieu de compter les cellules dans l'ordre, sinon tout se décale ;
3. les dates peuvent être des séries Excel (2020) ou du texte (2023).

Le conteneur d'ingestion se fait déjà OOM-kill et la mémoire est le premier poste de coût
Railway : une dépendance de plus pour deux lectures par an ne se justifie pas. `exceljs` reste
le plan B si le fichier 2026 sort une variante inattendue, il coûte une heure à brancher. Ne
jamais prendre le paquet `xlsx` de SheetJS, qui n'est plus publié sur le registre npm et
traîne des avis de sécurité.

Connecteur `services/ingestion/src/sources/senatoriales/`, avec une commande CLI dédiée
(`pnpm ingestion:senatoriales-candidats --file <path|url>`), idempotente, rejouable, et testée
**sur le fichier 2023 en fixture**.

### Contrôles qualité (à ajouter à `data-quality.ts`)

Invariants structurels, tolérance zéro :

1. les 64 circonscriptions de la série 2 sont couvertes, et aucune autre ;
2. **taille de liste uniforme par circonscription, égale au nombre de sièges + 2** (art. L. 300).
   Vérifié sur les 27 circonscriptions proportionnelles de 2023 sans une seule exception :
   Paris 12 sièges → 14 candidats, Nord 11 → 13, Français de l'étranger 6 → 8. C'est le
   validateur le plus fort dont on dispose, il recoupe même le nombre de sièges ;
3. alternance stricte homme/femme dans chaque liste proportionnelle ;
4. au majoritaire, suppléant de sexe opposé au titulaire ;
5. nombre de candidats ≥ nombre de sièges dans chaque circonscription.

Seuils :

6. taux de rattachement des candidats marqués `Sortant: OUI` proche de 100 % ;
7. nombre total de candidats cohérent avec l'ordre de grandeur attendu (2 000 à 2 300 pour
   178 sièges sur 64 circonscriptions, extrapolé des 1 829 candidats pour 170 sièges en 2023).

---

## 9. API

Étendre le module `senatoriales` existant.

- `GET /senatoriales/2026/candidats?departement&nuance&sortant&tri` — même forme que
  `/2026/sortants` : `{ data, meta: { total } }`, filtres et tris en mémoire sur une liste
  mise en cache une fois, jamais de clé de cache par combinaison de filtres.
- `/senatoriales/2026` (aperçu) enrichi de `candidatures: { total, sortantsCandidats,
  sortantsNonCandidats, dateSource }`.
- **Tout nouveau champ de DTO doit être optionnel côté web.** Le cache Redis a un TTL d'une
  heure : pendant le déploiement, l'API neuve et des réponses anciennes coexistent.
- Valider les nouveaux paramètres par regex dans `lireFiltres()` **avant** le fetch serveur :
  la clé du cache edge est l'URL entière.
- Purger `senatoriales:*` après chaque ingestion — les clés incluent tous les paramètres, un
  `DEL` simple ne suffit pas.

---

## 10. Runbook

- **2 → 10 sept.** — migration, connecteur, matching, API, UI. Développés et testés sur le
  fichier 2023 en fixture. Publication derrière un drapeau.
- **~15 sept.** — surveillance de l'API data.gouv sur le mot-clé, plutôt qu'un rafraîchissement
  manuel.
- **~18 sept., J-9** — ingestion, contrôles §8, purge Redis, levée du drapeau, publication,
  post réseaux.
- **27 sept. au soir** — marquage des élus depuis l'open data du Sénat. Revalidation ISR
  raccourcie sur les pages concernées le temps de la soirée, puis retour à 3600 s. Pas de page
  live rafraîchie en continu : l'egress est notre premier poste de coût.
- **~1er oct.** — XLSX résultats : voix, tour d'élection, participation des grands électeurs.
- **1er oct.** — bascule de mandature, déjà automatique via `deriveMandatureSenat`, garde-fou
  `SENAT_EFFECTIF_MIN = 300`.
- **5 → 7 oct.** — constitution des groupes, Bureau, bureaux des commissions.

---

## 11. Hors périmètre

Pronostics et projections de sièges. Scraping des préfectures. Photos de candidats. Listes
« pressenties » tirées de la presse entre le 11 et le 18 septembre : notre crédibilité tient à
ce que tout soit sourcé. Grands électeurs et délégués, cf. §2.5.
