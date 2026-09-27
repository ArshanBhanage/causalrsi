# The Causal Observatory

An interactive research instrument for [CausalRSI](https://github.com/Parth0248/CausalRSI):
causal credit assignment for recursive self-improving agents. The visitor observes a simulated
agent, intervenes on one of its components, holds to remove that change and watch the outcome
move, then sees causal credit propagate backward and feed the next generation.

**Every metric rendered by this site is an illustrative simulation value, not an experimental
result.** The underlying research project is an early-stage scaffold whose current toy-simulation
results are negative or unresolved, with research gates G1 and G2 open.

## Commands

Install:

    npm install

Develop:

    npm run dev

Build for production:

    npm run build

## Checks

    npm run typecheck
    npm run lint
    npm test

`npm test` runs the unit tests plus the eighteen property-based tests that guard the demo model's
arithmetic, the scroll state machine, the deterministic layout and the URL codec.

## Visual review

With a production build served locally:

    npm run build
    npm start -- -p 4317
    npm run review -- 1440x900 http://127.0.0.1:4317/ /tmp/crsi/review
    npm run review -- 390x844  http://127.0.0.1:4317/ /tmp/crsi/review
    npm run review -- 1440x900 http://127.0.0.1:4317/ /tmp/crsi/review --reduced

The harness drives a local Chrome, captures every narrative phase, and fails loudly on any browser
console error or warning.

## Environment notes

- **Node 20 or 22.** Node 25 hangs during `next build`; `.nvmrc` pins 20.19.6 and `engines`
  rejects 25 and above.
- **Avoid a file-syncing folder.** If the repository lives in an iCloud or Dropbox directory, the
  sync client can create duplicate generated files such as `.next/types/cache-life.d 2.ts`, which
  makes type checking report spurious duplicate-identifier errors. `tsconfig.json` excludes
  `.next` for this reason; if the build behaves strangely, delete `.next` and rebuild.
- ESLint is run as its own gate rather than inside `next build`.

## Layout

`lib/causalSimulation.ts` holds the deterministic demo model; every number on screen derives
from it. `content/site.ts` holds every factual claim; no component contains one. GLSL lives beside
the component that owns it rather than in a separate directory.

    app/          shell, fonts, metadata
    components/   shell, canvas, causal, scenes, typography, overlays, navigation
    hooks/        pointer lens, scroll, key bindings, reduced motion, audio
    lib/          simulation, layout, edges, geometry, motion, choreography, codec, performance
    content/      every factual claim
    scripts/      visual review and interaction harnesses
    styles/       palette, type scale, depth tokens
    tests/        unit and property-based tests
