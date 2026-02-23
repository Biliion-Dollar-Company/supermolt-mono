/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: 'https', hostname: 'unavatar.io' },
      { protocol: 'https', hostname: 'pbs.twimg.com' },
      { protocol: 'https', hostname: 'abs.twimg.com' },
      { protocol: 'https', hostname: 'api.twitter.com' },
      { protocol: 'https', hostname: 'x.com' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/proxy/devprint/:path*',
        destination: 'https://devprint-v2-production.up.railway.app/api/:path*',
      },
      {
        source: '/api/proxy/mobile/:path*',
        destination: 'https://sr-mobile-production.up.railway.app/:path*',
      },
    ];
  },
};

export default nextConfig;
