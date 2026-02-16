import { MetadataRoute } from 'next';

// Force dynamic rendering — the API is not available at Vercel build time
export const dynamic = 'force-dynamic';
export const revalidate = 86400; // Revalidate every 24 hours

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

async function fetchAllPages<T>(endpoint: string): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  const limit = 100;

  try {
    while (true) {
      const response = await fetch(`${API_URL}/api/v1${endpoint}?page=${page}&limit=${limit}`);

      if (!response.ok) break;

      const data: PaginatedResponse<T> = await response.json();
      if (!data.data || !Array.isArray(data.data)) break;
      items.push(...data.data);

      if (!data.meta || page >= data.meta.totalPages) break;
      page++;
    }
  } catch (error) {
    console.error(`Error fetching ${endpoint} for sitemap:`, error);
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
  ];

  // Fetch dynamic content
  const [deputes, senateurs, scrutins, lobbyistes, groupes, dossiers] = await Promise.all([
    fetchAllPages<DeputeItem>('/deputes'),
    fetchAllPages<SenateurItem>('/senateurs'),
    fetchAllPages<ScrutinItem>('/scrutins'),
    fetchAllPages<LobbyisteItem>('/lobbying'),
    fetchAllPages<GroupeItem>('/groupes'),
    fetchAllPages<DossierItem>('/dossiers'),
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

  // Scrutins pages
  const scrutinPages: MetadataRoute.Sitemap = scrutins.map((scrutin) => ({
    url: `${BASE_URL}/scrutins/${scrutin.numero}`,
    lastModified: scrutin.date,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

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

  return [
    ...staticPages,
    ...deputePages,
    ...senateurPages,
    ...scrutinPages,
    ...lobbyistePages,
    ...groupePages,
    ...dossierPages,
  ];
}
