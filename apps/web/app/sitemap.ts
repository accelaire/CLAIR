import { MetadataRoute } from 'next';
import { scrutinHref } from '@/lib/scrutin-url';

// Le sitemap est régénéré au plus une fois par heure. Il était auparavant en
// force-dynamic, donc reconstruit à chaque requête sur /sitemap.xml : chaque
// hit relançait une pagination complète de toutes les entités et saturait le
// rate-limit de l'API. Une heure suffit largement, l'ingestion ne tourne
// qu'une fois par jour (04:00 UTC).
export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

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

/** Nombre de reprises sur 429 avant d'abandonner une page. */
const MAX_429_RETRIES = 2;

/** Plafond d'attente entre deux reprises, pour rester sous le timeout Vercel. */
const MAX_RETRY_WAIT_MS = 10_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Récupère une page en réessayant sur 429.
 *
 * Le rate-limit de l'API accorde 200 req/min aux appels portant un Origin de
 * confiance contre 10 req/min aux autres. Sans cet en-tête, la pagination du
 * sitemap se faisait couper au bout de dix pages.
 */
async function fetchPage(url: string): Promise<Response | null> {
  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
    const response = await fetch(url, {
      headers: {
        // Node envoie "undici" par défaut, que le plugin rate-limit bloque
        // (voir apps/web/lib/api-server.ts).
        'User-Agent': 'CLAIR-Web-Sitemap/1.0',
        Origin: BASE_URL,
      },
    });

    if (response.status !== 429) return response;

    if (attempt === MAX_429_RETRIES) {
      console.error(`[sitemap] 429 persistant après ${attempt + 1} tentatives — ${url}`);
      return response;
    }

    const retryAfter = Number(response.headers.get('retry-after'));
    const waitMs = Math.min(
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt,
      MAX_RETRY_WAIT_MS,
    );
    console.warn(`[sitemap] 429, reprise dans ${waitMs}ms — ${url}`);
    await sleep(waitMs);
  }

  return null;
}

async function fetchAllPages<T>(endpoint: string): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  const limit = 100;
  // Une sortie de boucle avant la dernière page produit un sitemap tronqué.
  // On le signale explicitement au lieu de le laisser passer en silence.
  let truncated = false;

  try {
    while (true) {
      const url = `${API_URL}/api/v1${endpoint}?page=${page}&limit=${limit}`;
      const response = await fetchPage(url);

      if (!response || !response.ok) {
        console.error(
          `[sitemap] ${response?.status ?? 'no response'} ${response?.statusText ?? ''} — ${url}`,
        );
        truncated = true;
        break;
      }

      const data: PaginatedResponse<T> = await response.json();
      if (!data.data || !Array.isArray(data.data)) {
        truncated = true;
        break;
      }
      items.push(...data.data);

      if (!data.meta) break;
      if (page >= data.meta.totalPages) break;
      page++;
    }
  } catch (error) {
    console.error(`[sitemap] fetch failed — ${endpoint}`, error);
    truncated = true;
  }

  if (truncated) {
    console.error(
      `[sitemap] TRUNCATED ${endpoint} — ${items.length} entrées récupérées, arrêt page ${page}`,
    );
  }

  return items;
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
  const [deputes, senateurs, scrutins, lobbyistes, groupes, dossiers, sujets] = await Promise.all([
    fetchAllPages<DeputeItem>('/deputes'),
    fetchAllPages<SenateurItem>('/senateurs'),
    fetchAllPages<ScrutinItem>('/scrutins'),
    fetchAllPages<LobbyisteItem>('/lobbying'),
    fetchAllPages<GroupeItem>('/groupes'),
    fetchAllPages<DossierItem>('/dossiers'),
    fetchAllPages<SujetItem>('/sujets'),
  ]);

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
  ];
}
