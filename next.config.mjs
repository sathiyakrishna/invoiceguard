/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
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
