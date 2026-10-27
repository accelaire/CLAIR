# @clair/site

Nouveau site de CLAIR (Next 16, React 19, Mantine 9). Une route déclare ses métadonnées et rend un
écran de `@clair/screens` ; voir `docs/04-front/01-architecture/`.

```bash
pnpm --filter @clair/site dev     # http://localhost:3010
pnpm --filter @clair/site build   # n'a pas besoin de l'API (plan du site réduit si elle est injoignable)
```

## Variables d'environnement

Les variables `NEXT_PUBLIC_*` sont lues **au build** : les changer impose de reconstruire.

| Variable | Rôle | Valeur attendue en production |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Adresse publique du site, sans barre finale : `metadataBase`, adresses canoniques, `/sitemap.xml`, `/robots.txt`, JSON-LD, images de partage. Défaut : `https://beta.clair.vote`. | Bêta : `https://beta.clair.vote`. Après la bascule de `clair.vote` vers ce site : `https://clair.vote` (avec `SITE_INDEXABLE=true`). |
| `SITE_INDEXABLE` | `true` pour laisser les robots indexer le site. Sinon `robots.txt` interdit tout et chaque page porte `noindex`. | Absente (ou `false`) en bêta ; `true` après la bascule. |
| `NEXT_PUBLIC_API_URL` (ou `API_URL`) | Adresse de l'API, côté serveur et pour le proxy `/api/v1`. | `https://api.clair.vote` |
| `CLAIR_INTERNAL_SECRET` | Secret du trafic interne, ajouté par le serveur (rendu, proxy). Jamais préfixé `NEXT_PUBLIC_`. | Le secret partagé avec l'API. |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Site Plausible qui reçoit les visites. Absente : aucun script de mesure. | Le site déclaré dans Plausible (le même que apps/web, `clair.vote`, ou un site dédié à la bêta). |
| `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URLS` | Scripts Plausible, séparés par des virgules (défaut : `https://plausible.io/js/script.js`). Deux adresses font compter deux instances le temps d'une bascule. | `https://stats.clair.vote/js/script.js` pour l'instance auto-hébergée. |

`NEXT_PUBLIC_SITE_URL` remplace `NEXT_PUBLIC_APP_URL` de apps/web. Tant que la bêta tourne à
côté de apps/web, ne pas lui donner `https://clair.vote` : les canoniques et le plan du site
pointeraient vers l'ancien site.

## Référencement et mesure

- `app/sitemap.ts` : plan du site, prérendu puis régénéré au plus une fois par heure. Au build,
  une API injoignable réduit le plan aux pages statiques (journalisé) ; à la régénération, une
  erreur garde le dernier plan complet.
- `app/**/opengraph-image.tsx` : images de partage (`lib/og.tsx`).
- JSON-LD (`components/JsonLd.tsx`, fonctions `…JsonLd` de `@clair/screens`) : `Organization` et
  `WebSite` dans le layout, `Person`, `Event`, `Organization` et `BreadcrumbList` sur les fiches.
- Plausible (`components/PlausibleAnalytics.tsx`) : sans cookie, exempt de consentement.
- Formulaire de retour (`components/Feedback.tsx`) : `POST /api/v1/feedback`, seul chemin
  d'écriture relayé par le proxy.
