/** @type {import('next').NextConfig} */
const isGithubPages = process.env.GITHUB_PAGES === 'true';

const nextConfig = {
  output: 'export',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: { unoptimized: true },
  // When deploying to GitHub Pages the site lives under a sub-path.
  // Set GITHUB_PAGES=true in the Actions workflow to enable this.
  ...(isGithubPages && {
    basePath: '/RoziAteliyer',
    assetPrefix: '/RoziAteliyer/',
  }),
};

module.exports = nextConfig;
