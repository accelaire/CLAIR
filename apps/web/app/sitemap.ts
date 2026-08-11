import { MetadataRoute } from 'next';
import { scrutinHref } from '@/lib/scrutin-url';
import { internalHeaders } from '@/lib/internal-headers';

// Régénération quotidienne, calée sur l'ingestion (04:00 UTC) : rien ne change
// entre deux passages, donc rien ne justifie de reconstruire plus souvent.
//
// C'était auparavant force-dynamic, donc reconstruit à CHAQUE requête sur
// /sitemap.xml, chaque hit relançant une pagination complète de toutes les
// entités. C'est ce qui saturait le rate-limit et tronquait le sitemap.
export const revalidate = 86400;

// Une seule requête vers /api/v1/sitemap, mais elle rapporte ~2,5 Mo : on garde
// une marge confortable sur le timeout de la fonction de régénération.
export const maxDuration = 60;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface DeputeItem {
  slug: string;
  updatedAt?: string;
}

interface SenateurItem {
  slug: string;
  updatedAt?: string;
}

interface ScrutinItem {
  numero: number;
  chambre: string;
  session: string | null;
  date: string;
}

interface LobbyisteItem {
  id: string;
  updatedAt?: string;
}

interface GroupeItem {
  slug: string;
  chambre: string;
  updatedAt?: string;
}

interface DossierItem {
  uid: string;
  dateDepot?: string;
}

interface SujetItem {
  slug: string;
  updatedAt?: string;
}

interface SitemapData {
  deputes: DeputeItem[];
  senateurs: SenateurItem[];
  scrutins: ScrutinItem[];
  lobbyistes: LobbyisteItem[];
  dossiers: DossierItem[];
  sujets: SujetItem[];
}

const EMPTY_SITEMAP_DATA: SitemapData = {
  deputes: [],
  senateurs: [],
  scrutins: [],
  lobbyistes: [],
  dossiers: [],
  sujets: [],
};

/**
 * Échappe les caractères réservés XML dans une URL de sitemap.
 *
 * Next 14 sérialise les URLs telles quelles, sans échappement. Or les liens de
 * scrutin transportent obligatoirement `?chambre=…&session=…` (un numéro de
 * scrutin n'est unique dans aucune des deux chambres, cf. lib/scrutin-url.ts),
 * donc un `&` brut. Résultat : le sitemap n'était pas du XML bien formé et
 * était rejeté en entier par les moteurs — sur les 29 738 URLs, pas une seule
 * n'était exploitable.
 *
 * L'échappement ne change aucune adresse : `&amp;` se décode en `&`.
 *
 * La négative lookahead évite de doubler l'échappement si une entité est déjà
 * présente, et si une version future de Next se met à échapper elle-même il
 * faudra retirer cet appel.
 */
function escapeXmlUrl(url: string): string {
  return url
    .replace(/&(?!(?:amp|lt|gt|quot|apos);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// La troncature du sitemap est déjà réglée en amont : une régénération par jour
// et 2 requêtes au lieu de ~300, donc le rate-limit n'est plus une menace ici.
// Ce qui change, c'est le laissez-passer : ces 2 requêtes s'annonçaient avec un
// en-tête `Origin` que n'importe quel client peut copier. Le secret interne, lui,
// ne quitte jamais le serveur.
const SITEMAP_HEADERS = internalHeaders('CLAIR-Web-Sitemap/1.0');

/**
 * Récupère en une seule requête tout ce qu'il faut pour construire le sitemap.
 *
 * La version paginée précédente tirait ~300 requêtes, dont 218 pour les seuls
 * scrutins. Elle saturait le rate-limit à mi-parcours (200 req/min) et
 * publiait un sitemap tronqué : 11 801 scrutins indexés sur 21 731.
 */
/**
 * ⚠️ Cette fonction LÈVE en cas d'échec, elle ne dégrade pas.
 *
 * Renvoyer un jeu vide produisait un sitemap réduit aux quelques pages
 * statiques — et `revalidate` le figeait alors pour 24 h. Une indisponibilité
 * de quelques secondes de l'API coûtait donc une journée entière de sitemap
 * amputé de ~29 000 URLs, sans autre trace qu'un `console.error`. C'est la
 * panne silencieuse que ce fichier est justement censé avoir éliminée.
 *
 * En levant, la régénération ISR échoue et Next continue de servir la dernière
 * version saine : le sitemap vieillit au lieu de se vider. Au build, l'échec
 * est bruyant, ce qui est le comportement voulu — mieux vaut ne pas déployer
 * qu'écraser un sitemap correct par un sitemap vide.
 */
async function fetchSitemapData(): Promise<SitemapData> {
  const url = `${API_URL}/api/v1/sitemap`;

  const response = await fetch(url, { headers: SITEMAP_HEADERS });

  if (!response.ok) {
    throw new Error(`[sitemap] ${response.status} ${response.statusText} — ${url}`);
  }

  const data = (await response.json()) as Partial<SitemapData>;
  return { ...EMPTY_SITEMAP_DATA, ...data };
}

/**
 * Les groupes restent servis par leur liste publique : elle ne retourne que la
 * législature/session courante, et on ne veut pas dupliquer cette logique dans
 * l'endpoint sitemap. Une requête, quelques dizaines d'entrées.
 *
 * Contrairement à `fetchSitemapData`, un échec dégrade au lieu de lever : ces
 * quelques dizaines d'URLs ne valent pas de renoncer aux ~29 000 autres. Le
 * revers est qu'un sitemap sans groupes reste figé 24 h, sans autre trace que
 * cette ligne de log.
 */
async function fetchGroupes(): Promise<GroupeItem[]> {
  const url = `${API_URL}/api/v1/groupes?page=1&limit=100`;

  try {
    const response = await fetch(url, { headers: SITEMAP_HEADERS });

    if (!response.ok) {
      console.error(`[sitemap] ${response.status} ${response.statusText} — ${url}`);
      return [];
    }

    const body = (await response.json()) as { data?: GroupeItem[] };
    return Array.isArray(body.data) ? body.data : [];
  } catch (error) {
    console.error(`[sitemap] fetch failed — ${url}`, error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/deputes`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/senateurs`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/scrutins`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/votes`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/lobbying`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/lobbying/actions`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/groupes`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/recherche`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/explorateur`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/simulateur`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/classements`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/soutenir`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/deputes/comparer`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/senateurs/comparer`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/dossiers`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/sujets`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];

  // Fetch dynamic content
  const [data, groupes] = await Promise.all([fetchSitemapData(), fetchGroupes()]);
  const { deputes, senateurs, scrutins, lobbyistes, dossiers, sujets } = data;

  // Deputes pages
  const deputePages: MetadataRoute.Sitemap = deputes.map((depute) => ({
    url: `${BASE_URL}/deputes/${depute.slug}`,
    lastModified: depute.updatedAt || now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Senateurs pages
  const senateurPages: MetadataRoute.Sitemap = senateurs.map((senateur) => ({
    url: `${BASE_URL}/senateurs/${senateur.slug}`,
    lastModified: senateur.updatedAt || now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Scrutins pages. Le numéro n'est unique dans aucune des deux chambres : sans
  // chambre + session, plusieurs scrutins distincts partageraient la même URL.
  const scrutinPages: MetadataRoute.Sitemap = scrutins.map((scrutin) => ({
    url: `${BASE_URL}${scrutinHref(scrutin)}`,
    lastModified: scrutin.date,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Year / month archive pages (/votes/[year], /votes/[year]/[month]).
  // Emitted only for periods that actually have scrutins so Google doesn't
  // crawl empty pages.
  const archiveKeys = new Set<string>();
  const yearSet = new Set<string>();
  for (const s of scrutins) {
    if (!s.date || typeof s.date !== 'string') continue;
    const year = s.date.slice(0, 4);
    const month = s.date.slice(5, 7);
    if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) continue;
    yearSet.add(year);
    archiveKeys.add(`${year}/${month}`);
  }

  const yearArchivePages: MetadataRoute.Sitemap = Array.from(yearSet).map(
    (year) => ({
      url: `${BASE_URL}/votes/${year}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }),
  );

  const monthArchivePages: MetadataRoute.Sitemap = Array.from(archiveKeys).map(
    (key) => ({
      url: `${BASE_URL}/votes/${key}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    }),
  );

  // Lobbyistes pages
  const lobbyistePages: MetadataRoute.Sitemap = lobbyistes.map((lobbyiste) => ({
    url: `${BASE_URL}/lobbying/${lobbyiste.id}`,
    lastModified: lobbyiste.updatedAt || now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Groupes pages
  const groupePages: MetadataRoute.Sitemap = groupes.map((groupe) => ({
    url: `${BASE_URL}/groupes/${groupe.chambre}/${groupe.slug}`,
    lastModified: groupe.updatedAt || now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  // Dossiers pages
  const dossierPages: MetadataRoute.Sitemap = dossiers.map((dossier) => ({
    url: `${BASE_URL}/dossiers/${dossier.uid}`,
    lastModified: dossier.dateDepot || now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  // Sujets pages
  const sujetPages: MetadataRoute.Sitemap = sujets.map((sujet) => ({
    url: `${BASE_URL}/sujets/${sujet.slug}`,
    lastModified: sujet.updatedAt || now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [
    ...staticPages,
    ...deputePages,
    ...senateurPages,
    ...scrutinPages,
    ...yearArchivePages,
    ...monthArchivePages,
    ...lobbyistePages,
    ...groupePages,
    ...dossierPages,
    ...sujetPages,
  ].map((entry) => ({ ...entry, url: escapeXmlUrl(entry.url) }));
}
