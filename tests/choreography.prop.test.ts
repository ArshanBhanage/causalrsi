import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CAMERA_KEYFRAMES,
  IDLE_INTERACTION,
  PHASES,
  PHASE_BOUNDS,
  observatoryState,
  phaseIndexOf,
  progressForPhase,
  quantiseProgress,
} from '@/lib/choreography';
import { DEFAULT_SEED, layoutGraph, layoutTree } from '@/lib/graphLayout';
import { EDGES, LINEAGE, NODES } from '@/lib/causalSimulation';
import { lerpValue, smoothstep, stepSpring } from '@/lib/motion';

const RUNS = { numRuns: 200 };
const unit = fc.double({ min: 0, max: 1, noNaN: true });

/** Property 9: scroll state path independence. */
describe('Property 9: scroll state path independence', () => {
  it('any traversal reaching p yields the same state as evaluating p directly', () => {
    fc.assert(
      fc.property(unit, fc.array(unit, { minLength: 1, maxLength: 32 }), (p, path) => {
        const direct = observatoryState(p);
        let last = observatoryState(0);
        for (const step of path) last = observatoryState(step);
        last = observatoryState(p);

        expect(last.phase).toBe(direct.phase);
        expect(last.selected).toBe(direct.selected);
        expect(Math.abs(last.p - direct.p)).toBeLessThanOrEqual(1e-6);
        expect(Math.abs(last.camera.position.x - direct.camera.position.x)).toBeLessThanOrEqual(1e-6);
        expect(Math.abs(last.camera.fov - direct.camera.fov)).toBeLessThanOrEqual(1e-6);
        expect(Math.abs(last.mutation - direct.mutation)).toBeLessThanOrEqual(1e-6);
        expect(Math.abs(last.credit - direct.credit)).toBeLessThanOrEqual(1e-6);
      }),
      RUNS,
    );
  });
});

/** Property 10: monotone phase mapping. */
describe('Property 10: monotone phase mapping', () => {
  it('maps every p to exactly one phase with a monotone index', () => {
    fc.assert(
      fc.property(unit, unit, (a, b) => {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        const li = phaseIndexOf(lo);
        const hidx = phaseIndexOf(hi);
        expect(li).toBeGreaterThanOrEqual(1);
        expect(hidx).toBeLessThanOrEqual(7);
        expect(li).toBeLessThanOrEqual(hidx);
        expect(PHASES[li - 1]).toBeDefined();
      }),
      RUNS,
    );
  });

  it('pins the endpoints', () => {
    expect(phaseIndexOf(0)).toBe(1);
    expect(phaseIndexOf(1)).toBe(7);
  });

  it('assigns each boundary to the later phase', () => {
    PHASE_BOUNDS.forEach((bound, i) => {
      expect(phaseIndexOf(bound)).toBe(i + 1);
    });
  });

  it('lands inside the intended phase for index navigation', () => {
    PHASES.forEach((phase, i) => {
      expect(phaseIndexOf(progressForPhase(phase))).toBe(i + 1);
    });
  });
});

/** Property 18: progress domain robustness. */
describe('Property 18: progress domain robustness', () => {
  it('clamps out-of-range and non-finite input without throwing', () => {
    fc.assert(
      fc.property(fc.double({ noDefaultInfinity: false }), (raw) => {
        const state = observatoryState(raw, IDLE_INTERACTION);
        expect(state.p).toBeGreaterThanOrEqual(0);
        expect(state.p).toBeLessThanOrEqual(1);
        expect(PHASES).toContain(state.phase);
        expect(Number.isFinite(state.camera.fov)).toBe(true);
      }),
      RUNS,
    );
  });

  it('treats NaN as zero', () => {
    expect(quantiseProgress(Number.NaN)).toBe(0);
    expect(observatoryState(Number.NaN).phaseIndex).toBe(1);
  });

  it('keeps camera keyframes ordered', () => {
    for (let i = 1; i < CAMERA_KEYFRAMES.length; i += 1) {
      const prev = CAMERA_KEYFRAMES[i - 1];
      const next = CAMERA_KEYFRAMES[i];
      expect(next?.at ?? 0).toBeGreaterThan(prev?.at ?? 0);
    }
  });
});

/** Property 11: layout determinism. */
describe('Property 11: layout determinism', () => {
  it('produces identical coordinates for identical input', () => {
    fc.assert(
      fc.property(fc.integer(), fc.double({ min: 0.3, max: 3, noNaN: true }), (seed, aspect) => {
        const a = layoutGraph(NODES, EDGES, { seed, aspect });
        const b = layoutGraph(NODES, EDGES, { seed, aspect });
        expect(a).toEqual(b);
      }),
      { numRuns: 60 },
    );
  });

  it('is stable across many invocations with the default seed', () => {
    const first = layoutGraph(NODES, EDGES, { seed: DEFAULT_SEED, aspect: 16 / 9 });
    for (let i = 0; i < 100; i += 1) {
      expect(layoutGraph(NODES, EDGES, { seed: DEFAULT_SEED, aspect: 16 / 9 })).toEqual(first);
    }
  });

  it('lays out every node and every lineage record', () => {
    const layout = layoutGraph(NODES, EDGES);
    expect(layout.nodes).toHaveLength(NODES.length);
    expect(layout.extent).toBeGreaterThan(0);
    const tree = layoutTree(LINEAGE);
    expect(Object.keys(tree)).toHaveLength(LINEAGE.length);
  });
});

/** Property 16: interpolation bounds. */
describe('Property 16: interpolation bounds', () => {
  it('never leaves the closed endpoint interval', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (v0, v1, t) => {
          const out = lerpValue(v0, v1, t);
          expect(out).toBeGreaterThanOrEqual(Math.min(v0, v1) - 1e-9);
          expect(out).toBeLessThanOrEqual(Math.max(v0, v1) + 1e-9);
        },
      ),
      RUNS,
    );
  });

  it('hits both endpoints exactly', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        (v0, v1) => {
          expect(lerpValue(v0, v1, 0)).toBe(v0);
          expect(lerpValue(v0, v1, 1)).toBe(v1);
        },
      ),
      RUNS,
    );
  });

  it('keeps smoothstep monotone in [0,1]', () => {
    fc.assert(
      fc.property(unit, unit, (a, b) => {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        expect(smoothstep(lo)).toBeLessThanOrEqual(smoothstep(hi) + 1e-12);
      }),
      RUNS,
    );
  });

  it('never overshoots the spring target', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10, max: 10, noNaN: true }),
        fc.double({ min: -10, max: 10, noNaN: true }),
        (start, target) => {
          let p = start;
          let v = 0;
          for (let i = 0; i < 400; i += 1) {
            [p, v] = stepSpring(p, v, target, 1 / 60);
            const lo = Math.min(start, target) - 1e-6;
            const hi = Math.max(start, target) + 1e-6;
            expect(p).toBeGreaterThanOrEqual(lo);
            expect(p).toBeLessThanOrEqual(hi);
          }
          expect(Math.abs(p - target)).toBeLessThan(0.01);
        },
      ),
      { numRuns: 60 },
    );
  });
});
