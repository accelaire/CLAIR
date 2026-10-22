// =============================================================================
// Document OpenAPI de l'API (en-tête de la spécification servie sur /docs/json)
// =============================================================================
//
// Les routes y ajoutent leurs propres schémas. Ce module ne fixe que ce que la
// spécification dit d'elle-même : adresse, tags, schémas de sécurité. Il est
// séparé de `index.ts`, qui démarre le serveur à l'import, pour être testé.
// =============================================================================

import { INTERNAL_HEADER } from './utils/internal-auth';

/** Adresse publique de l'API, la seule à annoncer en production. */
export const PUBLIC_API_URL = 'https://api.clair.vote';

/** Nom du schéma de sécurité des routes réservées au trafic interne de CLAIR. */
export const INTERNAL_SECURITY_SCHEME = 'clairInternal';

/**
 * Tous les tags portés par les routes. Un tag utilisé par une route mais
 * absent d'ici apparaît sans description et hors ordre dans les explorateurs.
 */
export const OPENAPI_TAGS = [
  { name: 'Health', description: 'Endpoints de santé' },
  { name: 'Parlementaires', description: 'Données sur tous les parlementaires (députés + sénateurs)' },
  { name: 'Députés', description: 'Données sur les députés de l\'Assemblée nationale' },
  { name: 'Sénateurs', description: 'Données sur les sénateurs' },
  { name: 'Groupes politiques', description: 'Groupes parlementaires de l\'AN et du Sénat' },
  { name: 'Scrutins', description: 'Votes à l\'Assemblée nationale et au Sénat' },
  { name: 'Dossiers', description: 'Dossiers législatifs' },
  { name: 'Sujets', description: 'Sujets : dossiers de l\'AN et du Sénat portant sur le même texte' },
  { name: 'Commissions', description: 'Commissions et autres organes, AN et Sénat' },
  { name: 'Agenda', description: 'Agenda parlementaire : séances publiques, réunions, événements institutionnels' },
  { name: 'Lobbying', description: 'Données HATVP sur le lobbying' },
  { name: 'Senatoriales', description: 'Élections sénatoriales 2026 : sortants, candidats, résultats, élus' },
  { name: 'Search', description: 'Recherche globale' },
  { name: 'Analytics', description: 'Statistiques et analyses pour l\'explorateur' },
  { name: 'Homepage', description: 'Données de la page d\'accueil du site' },
  { name: 'Sitemap', description: 'Données du sitemap du site' },
  { name: 'Feedback', description: 'Retours anonymes envoyés depuis le site' },
];

/**
 * En-tête du document OpenAPI. En production, l'adresse annoncée est toujours
 * l'adresse publique : `API_URL` y vaut l'URL technique de l'hébergeur, que
 * les réutilisateurs n'ont pas à connaître. Hors production, `API_URL` permet
 * d'annoncer une autre adresse que `http://localhost:3001`.
 */
export function openapiDocument(isProduction: boolean, apiUrl: string | undefined) {
  return {
    info: {
      title: 'CLAIR API',
      description: 'API de la plateforme de transparence politique CLAIR',
      version: '0.1.0',
    },
    servers: [
      isProduction
        ? { url: PUBLIC_API_URL, description: 'Production' }
        : { url: apiUrl || 'http://localhost:3001', description: 'Development' },
    ],
    tags: OPENAPI_TAGS,
    components: {
      securitySchemes: {
        [INTERNAL_SECURITY_SCHEME]: {
          type: 'apiKey' as const,
          in: 'header',
          name: INTERNAL_HEADER,
          description:
            'Secret partagé entre les serveurs de CLAIR (rendu du site, ingestion). Il n\'est pas délivré : ' +
            'les routes qui l\'exigent ne sont pas ouvertes au public.',
        },
      },
    },
  };
}
