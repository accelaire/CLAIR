# CLAIR — Spécifications Techniques et Fonctionnelles

**Version** : 1.0.0  
**Date** : 30 décembre 2025  
**Statut** : Draft pour développement

---

## 1. Vision du Projet

### 1.1 Objectif
CLAIR (Citoyen Libre, Analyse, Information, République) est une plateforme de transparence politique destinée à la jeune génération française. Elle agrège, croise et présente de manière accessible les données publiques sur l'activité des élus, le lobbying et le financement politique.

### 1.2 Problème adressé
- Données politiques dispersées sur des dizaines de sources techniques
- UX inadaptée au grand public (vocabulaire juridique, interfaces datées)
- Impossibilité pour un citoyen lambda de vérifier la cohérence entre discours et actes
- Abstention et vote émotionnel par manque d'information factuelle

### 1.3 Proposition de valeur
- **Simplicité** : "Comprendre ton député en 30 secondes"
- **Factuel** : Données brutes + sources vérifiables, zéro opinion
- **Viral** : Format adapté aux réseaux sociaux (TikTok, Instagram, YouTube Shorts)
- **Actionnable** : Alertes, comparateurs, simulateurs pour 2027

---

## 2. Utilisateurs Cibles

### 2.1 Personas principaux

#### Persona 1 : Léa, 19 ans, étudiante
- Premier vote en 2027
- Consomme l'info via TikTok et Instagram
- Méfiante envers les médias traditionnels
- Veut des faits, pas des opinions
- **Besoin** : Comprendre rapidement qui fait quoi

#### Persona 2 : Thomas, 28 ans, développeur
- Vote mais se sent mal informé
- Aime les données et la transparence
- Partage du contenu politique sur Twitter/X
- **Besoin** : Accès aux données brutes + API

#### Persona 3 : Marie, 45 ans, enseignante
- Veut éduquer ses élèves à la citoyenneté
- Cherche des outils pédagogiques neutres
- **Besoin** : Interface simple à montrer en classe

### 2.2 Anti-personas (à ne pas cibler)
- Militants cherchant à confirmer leurs biais
- Journalistes professionnels (ils ont déjà leurs outils)
- Personnes cherchant du contenu partisan

---

## 3. Fonctionnalités

### 3.1 Module 1 : Fiches Élus ("Mon député en 30 secondes")

#### 3.1.1 Données affichées
| Donnée | Source | Priorité |
|--------|--------|----------|
| Identité (nom, photo, parti, circo) | Assemblée Nationale Open Data | P0 |
| Taux de présence en séance | Calculé depuis les scrutins | P0 |
| Votes clés (10 derniers scrutins importants) | Assemblée Nationale Open Data | P0 |
| Score de loyauté au groupe | Calculé | P1 |
| Interventions marquantes | DILA (Comptes rendus) | P1 |
| Amendements déposés | Assemblée Nationale Open Data | P2 |
| Déclaration de patrimoine | HATVP | P2 |
| Historique des mandats | Assemblée Nationale Open Data | P2 |

#### 3.1.2 Fonctionnalités
- **Recherche** : Par nom, circonscription, code postal, parti
- **Comparaison** : 2 à 4 députés côte à côte
- **Timeline** : Activité du député sur les 12 derniers mois
- **Alertes** : Notification push quand le député vote sur un sujet suivi
- **Partage** : Génération d'image/vidéo pour réseaux sociaux

#### 3.1.3 Score de cohérence "Dit vs Fait"
Algorithme croisant :
- Promesses de campagne (extraites manuellement + IA)
- Votes effectifs sur les sujets correspondants
- Déclarations médiatiques vs positions réelles

### 3.2 Module 2 : Lobbying ("Les coulisses du pouvoir")

#### 3.2.1 Données affichées
| Donnée | Source | Priorité |
|--------|--------|----------|
| Liste des représentants d'intérêts | HATVP Répertoire | P0 |
| Actions d'influence déclarées | HATVP Fiches activités | P0 |
| Budgets de lobbying par entité | HATVP | P1 |
| Personnes ciblées (députés, ministres) | HATVP | P1 |
| Corrélation lobbying → votes | Calcul interne | P2 |

#### 3.2.2 Fonctionnalités
- **Visualisation** : Graphe interactif lobbyiste ↔ élu ↔ loi
- **Timeline** : Chronologie lobbying → débat → vote
- **Recherche** : Par secteur (pharma, énergie, tech...), par entreprise
- **Alertes** : "Cette semaine, X a dépensé Y€ pour influencer Z"

### 3.3 Module 3 : Simulateur 2027

#### 3.3.1 Fonctionnalités
- **Quiz politique** : 20-30 questions sur des sujets clés
  - Basé sur les VOTES réels des partis (pas les discours)
  - Résultat : % de compatibilité avec chaque formation
- **Comparateur de programmes** : Tableau interactif
- **Fact-check intégré** : Vérification des claims de campagne
- **Historique** : "Ce que ton candidat a voté ces 5 ans"

### 3.4 Module 4 : Contenu viral

#### 3.4.1 Génération automatique
- **Shorts vidéo** : Incohérences flagrantes (discours vs vote)
- **Infographies** : Stats hebdomadaires de l'Assemblée
- **Threads** : Résumés des débats importants

#### 3.4.2 Format
- Durée : 15-60 secondes
- Résolution : 1080x1920 (vertical)
- Sous-titres intégrés
- Sources affichées à l'écran

---

## 4. Architecture Technique

### 4.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                  │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Web App       │   Mobile App    │   API Publique              │
│   (Next.js)     │   (React Native)│   (REST/GraphQL)            │
└────────┬────────┴────────┬────────┴─────────────┬───────────────┘
         │                 │                      │
         └─────────────────┼──────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                      API GATEWAY                                 │
│                      (Node.js/Fastify)                          │
├─────────────────────────────────────────────────────────────────┤
│  Auth  │  Rate Limiting  │  Caching  │  Logging  │  Analytics   │
└────────┬────────────────────────────────────────────────────────┘
         │
┌────────▼────────────────────────────────────────────────────────┐
│                      SERVICES MÉTIER                             │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│ Élus Service │ Lobby Service│ Votes Service│ Content Service    │
│              │              │              │ (Génération vidéo) │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────────┘
       │              │              │                │
┌──────▼──────────────▼──────────────▼────────────────▼───────────┐
│                      DATA LAYER                                  │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL (données structurées)                               │
│  Redis (cache, sessions, rate limiting)                         │
│  Meilisearch (recherche full-text)                              │
│  S3/Minio (assets, vidéos générées)                             │
└─────────────────────────────────────────────────────────────────┘
         │
┌────────▼────────────────────────────────────────────────────────┐
│                    INGESTION PIPELINE                            │
├─────────────────────────────────────────────────────────────────┤
│  Schedulers (cron)  │  Workers (Bull/Redis)  │  ETL Scripts     │
├─────────────────────────────────────────────────────────────────┤
│  Sources : Assemblée Nationale, DILA, HATVP, Légifrance        │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Stack technique détaillée

#### 4.2.1 Frontend Web
- **Framework** : Next.js 14+ (App Router)
- **UI** : Tailwind CSS + shadcn/ui
- **State** : Zustand (léger, simple)
- **Data fetching** : TanStack Query (React Query)
- **Charts** : Recharts ou D3.js
- **Animations** : Framer Motion

#### 4.2.2 Frontend Mobile
- **Framework** : React Native + Expo
- **Navigation** : Expo Router
- **UI** : NativeWind (Tailwind pour RN)
- **Notifications** : Expo Notifications + Firebase

#### 4.2.3 Backend
- **Runtime** : Node.js 20+ (LTS)
- **Framework** : Fastify (performance) ou NestJS (structure)
- **ORM** : Prisma
- **Validation** : Zod
- **Documentation API** : OpenAPI/Swagger auto-généré

#### 4.2.4 Base de données
- **Principal** : PostgreSQL 16
- **Cache** : Redis 7
- **Recherche** : Meilisearch (alternative légère à Elasticsearch)
- **Files** : S3-compatible (Minio en dev, Cloudflare R2 en prod)

#### 4.2.5 Infrastructure
- **Hébergement** : 
  - Dev/MVP : Vercel (frontend) + Railway (backend + DB)
  - Prod : Scaleway/OVH (souveraineté française)
- **CI/CD** : GitHub Actions
- **Monitoring** : Sentry + Prometheus/Grafana
- **CDN** : Cloudflare

#### 4.2.6 IA/ML
- **LLM** : Claude API (Anthropic) pour :
  - Résumés automatiques des débats
  - Extraction d'arguments des interventions
  - Génération de scripts vidéo
- **Embeddings** : Pour recherche sémantique (optionnel P2)

---

## 5. Modèle de données

### 5.1 Schéma principal

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Depute      │     │     Scrutin     │     │      Vote       │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id              │     │ id              │     │ id              │
│ slug            │     │ numero          │     │ depute_id (FK)  │
│ nom             │     │ date            │     │ scrutin_id (FK) │
│ prenom          │     │ titre           │     │ position        │
│ sexe            │     │ type            │     │ mise_au_point   │
│ date_naissance  │     │ sort            │     │ created_at      │
│ profession      │     │ nombre_votants  │     └─────────────────┘
│ photo_url       │     │ nombre_pour     │
│ twitter         │     │ nombre_contre   │     ┌─────────────────┐
│ groupe_id (FK)  │     │ nombre_abstention│    │  Intervention   │
│ circo_id (FK)   │     │ tags[]          │     ├─────────────────┤
│ actif           │     │ importance      │     │ id              │
│ created_at      │     │ created_at      │     │ depute_id (FK)  │
│ updated_at      │     └─────────────────┘     │ seance_id (FK)  │
└─────────────────┘                             │ texte           │
        │                                       │ date            │
        │         ┌─────────────────┐           │ type            │
        │         │  GroupePolitique │          │ mots_cles[]     │
        │         ├─────────────────┤           │ created_at      │
        └────────►│ id              │           └─────────────────┘
                  │ nom             │
                  │ slug            │           ┌─────────────────┐
                  │ couleur         │           │   Lobbyiste     │
                  │ position        │           ├─────────────────┤
                  │ created_at      │           │ id              │
                  └─────────────────┘           │ siren           │
                                               │ nom             │
┌─────────────────┐     ┌─────────────────┐    │ type            │
│ Circonscription │     │  ActionLobby    │    │ secteur         │
├─────────────────┤     ├─────────────────┤    │ budget_annuel   │
│ id              │     │ id              │    │ nb_lobbyistes   │
│ departement     │     │ lobbyiste_id(FK)│    │ created_at      │
│ numero          │     │ depute_id (FK)  │    │ updated_at      │
│ nom             │     │ description     │    └─────────────────┘
│ population      │     │ date_debut      │
│ geometry (GIS)  │     │ date_fin        │
└─────────────────┘     │ budget          │
                        │ resultat        │
                        │ created_at      │
                        └─────────────────┘
```

### 5.2 Tables additionnelles

```sql
-- Promesses de campagne
CREATE TABLE promesses (
    id UUID PRIMARY KEY,
    depute_id UUID REFERENCES deputes(id),
    parti_id UUID REFERENCES groupes_politiques(id),
    texte TEXT NOT NULL,
    source_url TEXT,
    date_promesse DATE,
    categorie VARCHAR(100),
    statut VARCHAR(50), -- 'non_evaluee', 'tenue', 'partiellement_tenue', 'non_tenue'
    scrutins_lies UUID[], -- Référence aux scrutins pertinents
    created_at TIMESTAMP DEFAULT NOW()
);

-- Alertes utilisateurs
CREATE TABLE alertes (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    type VARCHAR(50), -- 'depute_vote', 'lobby_action', 'nouveau_scrutin'
    cible_id UUID, -- ID du député, lobbyiste, ou sujet suivi
    actif BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Contenu généré (vidéos, infographies)
CREATE TABLE contenus (
    id UUID PRIMARY KEY,
    type VARCHAR(50), -- 'video_short', 'infographie', 'thread'
    titre TEXT,
    description TEXT,
    data JSONB, -- Données structurées pour génération
    fichier_url TEXT,
    statut VARCHAR(50), -- 'draft', 'generated', 'published'
    vues INTEGER DEFAULT 0,
    partages INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 6. APIs Sources

### 6.1 Assemblée Nationale Open Data

**Base URL** : `https://data.assemblee-nationale.fr`

| Dataset | Description | Format |
|---------|-------------|--------|
| `/repository/17/amo/deputes_actifs_mandats_actifs_organes/` | Députés, groupes, mandats | ZIP/JSON |
| `/repository/17/loi/scrutins/` | Scrutins avec votes individuels | ZIP/JSON |
| `/repository/17/loi/amendements/` | Amendements | ZIP/JSON |

**Accès** : Téléchargement bulk en ZIP, pas de clé API nécessaire

### 6.2 DILA (Comptes rendus des débats)

**Base URL** : `https://echanges.dila.gouv.fr/OPENDATA/Debats/AN`

| Ressource | Description | Format |
|-----------|-------------|--------|
| `/{année}/AN_*.taz` | Comptes rendus intégraux des séances | TAR/XML |

**Accès** : Téléchargement direct, pas de clé API nécessaire

### 6.3 HATVP (Lobbying)

**Base URL** : `https://www.hatvp.fr`

| Ressource | Accès |
|-----------|-------|
| Répertoire des représentants d'intérêts | Web scraping ou export CSV périodique |
| Fiches d'activités | API non publique, scraping nécessaire |
| Déclarations de patrimoine | PDF, nécessite OCR |

**Note** : Pas d'API officielle, prévoir du scraping éthique

### 6.4 Légifrance/PISTE (optionnel)

**Base URL** : `https://sandbox-api.piste.gouv.fr/dila/legifrance/lf-engine-app`

| Ressource | Description |
|-----------|-------------|
| `/search` | Recherche dans les textes de loi (JORF, CODE, LODA) |

**Accès** : Clé API gratuite, inscription sur https://piste.gouv.fr

---

## 7. Sécurité

### 7.1 Authentification
- **Méthode** : JWT + Refresh tokens
- **Providers** : Email/password + OAuth (Google, Apple)
- **2FA** : Optionnel pour les comptes premium

### 7.2 Autorisations
- **Public** : Consultation des fiches, recherche
- **Authentifié** : Alertes, favoris, historique
- **Premium** : API access, exports, alertes illimitées
- **Admin** : Modération, gestion contenu

### 7.3 Protection des données
- **RGPD** : Conformité totale
  - Pas de données personnelles des citoyens stockées inutilement
  - Export/suppression des données utilisateurs
- **Données publiques** : Les données sur les élus sont publiques par nature
- **Logs** : Anonymisation après 30 jours

### 7.4 Rate Limiting
- API publique : 100 req/min par IP
- API authentifiée : 1000 req/min
- API premium : 10000 req/min

---

## 8. Performance

### 8.1 Objectifs
| Métrique | Cible |
|----------|-------|
| Time to First Byte (TTFB) | < 200ms |
| Largest Contentful Paint (LCP) | < 2.5s |
| First Input Delay (FID) | < 100ms |
| Cumulative Layout Shift (CLS) | < 0.1 |
| API response time (p95) | < 500ms |

### 8.2 Stratégies
- **CDN** : Assets statiques sur Cloudflare
- **Cache** : Redis pour données chaudes (fiches députés)
- **ISR** : Incremental Static Regeneration pour pages semi-statiques
- **Database** : Index optimisés, connection pooling
- **Compression** : Brotli pour tous les assets

---

## 9. Roadmap

### Phase 1 : MVP (8 semaines)
- [ ] Infrastructure de base (repo, CI/CD, DB)
- [ ] Ingestion Assemblée Nationale (députés + votes)
- [ ] API REST basique
- [ ] Frontend web : fiches députés + recherche
- [ ] Landing page + waitlist

### Phase 2 : Core Features (8 semaines)
- [ ] Ingestion HATVP (lobbying)
- [ ] Module lobbying
- [ ] Alertes utilisateurs
- [ ] App mobile v1
- [ ] Génération contenu viral (v1)

### Phase 3 : Élections 2027 (12 semaines)
- [ ] Simulateur politique
- [ ] Comparateur de programmes
- [ ] Fact-checking intégré
- [ ] API publique

### Phase 4 : Scale (ongoing)
- [ ] Optimisations performance
- [ ] Features communautaires
- [ ] Internationalisation (autres pays EU ?)

---

## 10. Métriques de succès

### 10.1 KPIs techniques
- Uptime : > 99.9%
- Erreur rate : < 0.1%
- Temps de réponse API p95 : < 500ms

### 10.2 KPIs produit
- MAU (Monthly Active Users) : 100K à 6 mois
- Taux de rétention J7 : > 30%
- NPS : > 50
- Partages sociaux : 10K/mois

### 10.3 KPIs impact
- Mentions presse
- Utilisation par enseignants
- Citations par médias comme source

---

## Annexes

### A. Glossaire
- **Scrutin** : Vote formel à l'Assemblée nationale
- **Amendement** : Proposition de modification d'un texte de loi
- **Représentant d'intérêts** : Lobbyiste enregistré à la HATVP
- **Groupe politique** : Regroupement de députés par affinité politique

### B. Références
- [Assemblée Nationale Open Data](https://data.assemblee-nationale.fr/)
- [DILA Débats AN](https://echanges.dila.gouv.fr/OPENDATA/Debats/AN/)
- [HATVP Répertoire](https://www.hatvp.fr/le-repertoire/)
- [Légifrance/PISTE](https://piste.gouv.fr/)

### C. Contacts sources
- Assemblée Nationale Open Data : data@assemblee-nationale.fr
- DILA : donnees-dila@dila.gouv.fr
