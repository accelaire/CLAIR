/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
