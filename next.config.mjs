/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Without this, Next infers the workspace root from a stray lockfile higher up the tree and
  // file tracing walks the whole home directory, which wedges the build.
  outputFileTracingRoot: import.meta.dirname,

  // The instrument has no server-side behaviour: one prerendered page, no route handlers, no
  // server actions. A static export is therefore the whole site, which is what Cloudflare Pages
  // serves from `out/`.
  output: 'export',

  // Static hosting cannot run the image optimiser. Nothing here uses next/image, but this keeps
  // the export honest if that changes.
  images: { unoptimized: true },

  // Lint and type-check are explicit gates (`npm run lint`, `npm run typecheck`).
  // Running ESLint inside `next build` stalls on this project, so it is disabled here only.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
