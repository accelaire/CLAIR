/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
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
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
