/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lint and type-check are explicit gates (`npm run lint`, `npm run typecheck`).
  // Running ESLint inside `next build` stalls on this project, so it is disabled here only.
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingRoot: import.meta.dirname,
  transpilePackages: ['three'],
};

export default nextConfig;
