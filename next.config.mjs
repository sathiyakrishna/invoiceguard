/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // The app uses no next/image, so turn off the /_next/image optimizer endpoint (a recurring source of Next.js advisories).
  images: { unoptimized: true },
  webpack: (config) => {
    config.resolve.alias.canvas = false; // pdf.js requires 'canvas' only under Node, to render; we only read text in the browser
    return config;
  },
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
      ]
    }];
  }
};
export default nextConfig;
