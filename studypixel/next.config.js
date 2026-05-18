/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    tsconfigPath: './tsconfig.json',
  },
  turbopack: {
    root: __dirname,
  },
  reactStrictMode: true,
};

module.exports = nextConfig;