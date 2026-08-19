/**
 * Rendu serveur des pages de liste.
 *
 * ## Le problème
 *
 * Nos pages de liste lisent leurs filtres dans l'URL (`useUrlFilters` →
 * `useSearchParams`) et enveloppent leur contenu dans une `<Suspense>`. Sur une
 * route pré-rendue au build, Next ne connaît pas les paramètres de recherche :
 * il abandonne le pré-rendu du sous-arbre et écrit à la place le `fallback` de
 * la `<Suspense>` la plus proche. Le HTML servi ne contient donc que le
 * squelette de chargement — une quinzaine de kilo-octets d'`animate-pulse`,
 * sans un seul nom de député, de scrutin ou de dossier.
 *
 * Le navigateur ne voit pas la différence : React hydrate et affiche aussitôt.
 * Mais un lecteur qui n'exécute pas le JavaScript — robot d'aperçu social, une
 * partie des moteurs — ne reçoit rien d'indexable.
 *
 * ## Le remède, en trois pièces
 *
 * 1. `export const dynamic = 'force-dynamic'` dans le `page.tsx`. Les
 *    paramètres de recherche sont alors connus au moment du rendu, et l'arbre
 *    est rendu en entier côté serveur.
 *
 * 2. Un appel à `fetchFromApi` dans le `page.tsx`, dont le résultat descend en
 *    `initialData` du `useQuery` / `useInfiniteQuery` correspondant. Sans lui,
 *    le rendu serveur produirait un composant en état de chargement : le
 *    squelette, à nouveau, mais cette fois facturé.
 *
 * 3. Une entrée de cache edge sur le chemin, dans `vercel.json`. Le rendu à la
 *    demande se paierait sinon à chaque visite. Le motif est celui du proxy
 *    `app/api/v1/[...path]/route.ts` : `Vercel-CDN-Cache-Control` porte le TTL
 *    côté CDN, `Cache-Control` laisse le navigateur revalider.
 *
 * ## La même pièce 3, pour les pages de détail
 *
 * Les fiches (`/deputes/:slug`, `/scrutins/:numero`, `/dossiers/:uid`…) ont les
 * mêmes entrées dans `vercel.json`, pour une raison voisine mais distincte :
 * `useSearchParams` dans leur `PageClient` — la chambre et la session font
 * partie de l'identité d'un scrutin — suffit à les faire rendre à la demande.
 * Elles répondaient donc `no-store` sur les ~30 000 URLs du sitemap, sans
 * jamais toucher le cache edge : un rendu serverless complet par visite, y
 * compris pour chaque passage d'un robot.
 *
 * Leur TTL est d'une heure là où les listes tiennent dix minutes : leur contenu
 * ne bouge qu'au passage du cron d'ingestion, à 5 h. C'est aussi la fenêtre de
 * `REVALIDATE_LISTE_S` et le `revalidate` par défaut de `fetchFromApi`, donc
 * rien ne se périme plus vite que le maillon en amont.
 *
 * Ce cache est sûr parce que le HTML rendu n'est jamais personnalisé :
 * l'authentification est entièrement côté client, et aucun `cookies()` ni
 * `headers()` n'est lu dans `app/`. Toute évolution sur ce point invaliderait
 * ces entrées, pas seulement celles des listes.
 *
 * ## Et pour les quatre fiches qui n'ont aucun paramètre d'URL
 *
 * `/deputes/:slug`, `/senateurs/:slug`, `/lobbying/:id` et `/sujets/:slug` ne
 * lisent aucun paramètre de recherche, ni côté serveur ni côté client. Elles
 * étaient pourtant rendues à la demande (`λ` au build), pour une raison de
 * cadrage Next : un segment dynamique sans `generateStaticParams` n'est jamais
 * pré-rendu, donc jamais conservé.
 *
 * D'où le couple `revalidate` + `generateStaticParams` renvoyant un tableau
 * vide : rien n'est généré au build — pré-rendre 6 612 fiches y coûterait
 * autant d'appels API — mais chaque page rendue à la première visite est
 * ensuite conservée et resservie. C'est ce que le cache edge seul ne donne pas
 * sur un corpus de longue traîne, où une entrée CDN est évincée bien avant
 * d'être redemandée.
 *
 * Ce régime déplace un risque : une page en échec n'est plus une requête ratée,
 * c'est un résultat conservé et resservi. Un `notFound()` déclenché par une
 * panne passagère de l'API se figerait donc en 404 pour tout le monde. C'est
 * exactement ce que `fetchRessource` (`lib/api-server`) empêche, en ne
 * renvoyant `null` que sur un vrai 404. Toute fiche passée en ISR doit passer
 * par elle, jamais par `fetchFromApi`.
 *
 * ## Ce que la donnée initiale couvre
 *
 * Uniquement la vue sans filtre, première page. C'est l'URL canonique, la seule
 * qu'on cherche à faire indexer, et celle que le cache edge amortit. Dès qu'un
 * filtre est actif, le composant repart sur un chargement client : la donnée
 * initiale ne correspondrait pas à ce qui est demandé.
 *
 * D'où la garde `aucunFiltre` ci-dessous, à appliquer avant de passer
 * `initialData`.
 *
 * ## Pages volontairement laissées de côté
 *
 * - `/agenda` : le mois affiché vient de `new Date()` lu en heure locale
 *   (`app/agenda/PageClient.tsx`). Un serveur en UTC et un lecteur à Paris ne
 *   tombent pas d'accord sur le mois courant à cheval sur un changement de
 *   mois : le rendu serveur porterait sur une fenêtre différente de celle que
 *   le client recalcule, avec divergence d'hydratation à la clé. Il faut
 *   d'abord fixer le fuseau de référence, comme `lib/senatoriales.ts` le fait
 *   pour son basculement.
 * - `/recherche`, `/deputes/comparer`, `/senateurs/comparer` : leur contenu
 *   n'existe qu'en réponse à une saisie (`q`, `slugs`). Sans paramètre il n'y a
 *   rien à rendre, donc rien à indexer — les passer en rendu à la demande
 *   coûterait sans rien produire.
 */

import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

/**
 * Durée de fraîcheur des données hydratées, alignée sur le `revalidate` des
 * appels serveur.
 *
 * Sans elle, React Query juge les données périmées dès le montage et relance la
 * requête : la liste transiterait deux fois, une fois dans le HTML et une fois
 * sur le réseau, ce qui annule le bénéfice du rendu serveur.
 */
export const STALE_TIME_LISTE_MS = 3_600_000;

/** Fenêtre de revalidation des appels serveur, en secondes. */
export const REVALIDATE_LISTE_S = 3600;

/**
 * La vue est-elle celle sans aucun filtre ?
 *
 * Garde à poser devant `initialData` : la donnée récupérée côté serveur ne vaut
 * que pour la vue canonique. Une chaîne vide compte comme « pas de filtre »,
 * `useUrlFilters` renvoyant `''` et non `undefined` pour une clé absente.
 */
export function aucunFiltre(valeurs: (string | undefined | null)[]): boolean {
  return valeurs.every((v) => !v);
}

export type ParametresUrl = Record<string, string | string[] | undefined>;

/**
 * Numéro de page à rendre côté serveur, ou `null` si la liste ne doit pas
 * exposer de pagination explorable.
 *
 * Les listes se parcourent au défilement infini, que les robots n'exécutent
 * pas : au-delà de la première page, aucune fiche n'a de lien entrant sur le
 * site. `?page=N` rouvre ce chemin, en rendant côté serveur la tranche
 * demandée et en l'accompagnant de vrais liens (`components/Pagination`).
 *
 * Renvoie `null` dans deux cas, qui appellent le même traitement — rendre la
 * première page, sans navigation :
 *
 * - un filtre est actif. La donnée initiale ne vaut que pour la vue sans
 *   filtre (cf. `aucunFiltre`), et le nombre de pages affiché porterait sur le
 *   corpus complet, pas sur le résultat filtré. C'est aussi ce qui garde
 *   l'espace explorable borné : on ne veut pas ouvrir aux moteurs le produit
 *   cartésien des filtres et des pages.
 * - la valeur n'est pas un entier positif. Un `?page=abc` n'a pas à devenir une
 *   URL canonique.
 */
export function pageListe(
  searchParams: ParametresUrl,
  clesFiltre: readonly string[],
): number | null {
  const actif = (cle: string) => {
    const valeur = searchParams[cle];
    return Array.isArray(valeur) ? valeur.length > 0 : Boolean(valeur);
  };
  if (clesFiltre.some(actif)) return null;

  const brut = searchParams.page;
  const valeur = Array.isArray(brut) ? brut[0] : brut;
  if (valeur === undefined || valeur === '') return 1;
  if (!/^[1-9]\d*$/.test(valeur)) return null;

  return Number(valeur);
}

/**
 * Métadonnées d'une page de liste, ajustées à la page demandée.
 *
 * Deux corrections, toutes deux nécessaires pour que la pagination serve à
 * quelque chose :
 *
 * - la canonique pointe sur elle-même. Laisser les 1 087 pages de `/scrutins`
 *   se déclarer canoniques vers `/scrutins` revient à dire au moteur qu'elles
 *   sont la même page, ce qui les fait retomber dans le motif « page en double »
 *   au lieu d'être explorées.
 * - le titre porte le numéro de page, sans quoi elles sont indiscernables les
 *   unes des autres.
 *
 * La description reste commune : elle décrit la liste, qui ne change pas d'une
 * page à l'autre.
 */
export function metadonneesListe(
  base: Metadata,
  cheminCanonique: string,
  page: number | null,
): Metadata {
  if (page === null || page === 1) return base;

  const url = `${BASE_URL}${cheminCanonique}?page=${page}`;

  return {
    ...base,
    title: typeof base.title === 'string' ? `${base.title} — page ${page}` : base.title,
    alternates: { ...base.alternates, canonical: url },
  };
}
