const { SUJET_SLUG_REDIRECTS } = require('./lib/sujet-slug-redirects');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    // 301 sur les sujets renommés (slug technique → slug lisible). Traité à
    // l'edge, avant tout rendu : aucune requête API pour les anciennes URLs.
    return [
      ...SUJET_SLUG_REDIRECTS.map(({ from, to }) => ({
        source: `/sujets/${from}`,
        destination: `/sujets/${to}`,
        permanent: true,
      })),
      // Les aperçus des résultats des sénatoriales, relus la veille du scrutin
      // puis fondus dans les pages publiques. Déclarés avant la route
      // `[departement]`, qui sinon répondrait 404 à `apercu-resultats`.
      {
        source: '/senatoriales-2026/apercu-resultats',
        destination: '/senatoriales-2026',
        permanent: true,
      },
      {
        source: '/senatoriales-2026/apercu-resultats/:departement',
        destination: '/senatoriales-2026/:departement',
        permanent: true,
      },
    ];
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www2.assemblee-nationale.fr',
        pathname: '/static/tribun/**',
      },
      {
        protocol: 'https',
        hostname: 'www.assemblee-nationale.fr',
        pathname: '/dyn/**',
      },
      {
        protocol: 'https',
        hostname: 'www.senat.fr',
        pathname: '/senimg/**',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        pathname: '/**',
      },
    ],
  },
  // Plus de rewrite `/api/:path*` vers l'API : le proxy
  // `app/api/v1/[...path]/route.ts` le remplace. Un rewrite ne peut pas ajouter
  // d'en-tête à la requête sortante, il ne pouvait donc pas porter le secret
  // interne — c'est précisément ce qu'il fallait pour authentifier le frontend.
};

module.exports = nextConfig;
