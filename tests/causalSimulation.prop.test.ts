import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ATTRIBUTION,
  COMPONENT_IDS,
  EDGES,
  INITIAL_MODEL,
  LINEAGE,
  MUTABLE_IDS,
  NODES,
  applyIntervention,
  availableVersion,
  computeAttribution,
  computeCreditFlow,
  deriveCounterfactual,
  hasCycle,
  reachableFrom,
  reset,
  sinkNodes,
  sourceNodes,
  type ComponentId,
  type Intervention,
  type ObservatoryModel,
} from '@/lib/causalSimulation';

const RUNS = { numRuns: 200 };
const TOL = 1e-9;

const componentArb = fc.constantFrom(...(COMPONENT_IDS as ComponentId[]));
const mutableArb = fc.constantFrom(...(MUTABLE_IDS as ComponentId[]));
const agentIdArb = fc.constantFrom(
  INITIAL_MODEL.baseline.id,
  INITIAL_MODEL.factual.id,
  ...LINEAGE.map((a) => a.id),
);

function validIntervention(component: ComponentId): Intervention | null {
  const version = availableVersion(INITIAL_MODEL, component);
  return version === null ? null : { component, version };
}

function applyAll(
  model: ObservatoryModel,
  interventions: readonly Intervention[],
): ObservatoryModel {
  return interventions.reduce<ObservatoryModel>((m, i) => {
    const r = applyIntervention(m, i);
    return r.ok ? r.value : m;
  }, model);
}

/** Property 1: decomposition closure. */
describe('Property 1: decomposition closure', () => {
  it('holds for every ordered pair of agent versions', () => {
    fc.assert(
      fc.property(agentIdArb, agentIdArb, (from, to) => {
        const r = computeAttribution(INITIAL_MODEL, from, to);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const a = r.value;
        const contrib = a.contributions.reduce((s, c) => s + c.value, 0);
        const inter = a.interactions.reduce((s, i) => s + i.value, 0);
        for (const c of a.contributions) expect(Number.isFinite(c.value)).toBe(true);
        expect(Number.isFinite(a.residual)).toBe(true);
        expect(Math.abs(a.totalDelta - contrib - inter - a.residual)).toBeLessThanOrEqual(TOL);
        if (from === to) {
          expect(a.contributions).toHaveLength(0);
          expect(a.interactions).toHaveLength(0);
          expect(a.totalDelta).toBe(0);
          expect(a.residual).toBe(0);
        }
      }),
      RUNS,
    );
  });
});

/** Property 2: counterfactual arithmetic consistency. */
describe('Property 2: counterfactual arithmetic consistency', () => {
  it('factual minus counterfactual equals the attributed effect', () => {
    fc.assert(
      fc.property(mutableArb, (component) => {
        const r = deriveCounterfactual(INITIAL_MODEL, component);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const { factualScore, counterfactualScore, attributedEffect } = r.value;
        expect(
          Math.abs(factualScore - counterfactualScore - attributedEffect),
        ).toBeLessThanOrEqual(TOL);
      }),
      RUNS,
    );
  });
});

/** Property 3: intervention idempotence. */
describe('Property 3: intervention idempotence', () => {
  it('applying twice equals applying once', () => {
    fc.assert(
      fc.property(mutableArb, (component) => {
        const i = validIntervention(component);
        if (i === null) return;
        const once = applyIntervention(INITIAL_MODEL, i);
        expect(once.ok).toBe(true);
        if (!once.ok) return;
        const twice = applyIntervention(once.value, i);
        expect(twice.ok).toBe(true);
        if (!twice.ok) return;
        expect(twice.value).toEqual(once.value);
      }),
      RUNS,
    );
  });
});

/** Property 4: reset round trip. */
describe('Property 4: reset round trip', () => {
  it('reset after any sequence returns the initial state', () => {
    fc.assert(
      fc.property(fc.array(mutableArb, { maxLength: 16 }), (components) => {
        const before = JSON.stringify(INITIAL_MODEL);
        const seq = components
          .map(validIntervention)
          .filter((i): i is Intervention => i !== null);
        const after = applyAll(INITIAL_MODEL, seq);
        expect(reset(after)).toEqual(INITIAL_MODEL);
        expect(JSON.stringify(INITIAL_MODEL)).toBe(before);
      }),
      RUNS,
    );
  });
});

/** Property 5: confluence on distinct components. */
describe('Property 5: confluence on distinct components', () => {
  it('order does not matter', () => {
    fc.assert(
      fc.property(mutableArb, mutableArb, (a, b) => {
        if (a === b) return;
        const ia = validIntervention(a);
        const ib = validIntervention(b);
        if (ia === null || ib === null) return;
        expect(applyAll(INITIAL_MODEL, [ia, ib])).toEqual(applyAll(INITIAL_MODEL, [ib, ia]));
      }),
      RUNS,
    );
  });
});

/** Property 6: counterfactual non-mutation. */
describe('Property 6: counterfactual non-mutation', () => {
  it('leaves the factual state untouched and is stable across repeats', () => {
    fc.assert(
      fc.property(mutableArb, (component) => {
        const before = JSON.stringify(INITIAL_MODEL);
        const first = deriveCounterfactual(INITIAL_MODEL, component);
        const second = deriveCounterfactual(INITIAL_MODEL, component);
        expect(JSON.stringify(INITIAL_MODEL)).toBe(before);
        expect(first).toEqual(second);
      }),
      RUNS,
    );
  });
});

/** Property 7: topology invariants. */
describe('Property 7: topology invariants', () => {
  it('acyclic, single REWARD sink, resolvable endpoints, full reachability', () => {
    expect(hasCycle(NODES, EDGES)).toBe(false);
    expect(sinkNodes(NODES, EDGES)).toEqual(['REWARD']);
    for (const e of EDGES) {
      expect(e.from).not.toBe(e.to);
      expect(COMPONENT_IDS).toContain(e.from);
      expect(COMPONENT_IDS).toContain(e.to);
    }
    const sources = sourceNodes(NODES, EDGES);
    expect(sources.length).toBeGreaterThan(0);
    const reached = reachableFrom(EDGES, sources);
    for (const n of NODES) expect(reached.has(n.id)).toBe(true);
  });

  it('every node reaches REWARD', () => {
    fc.assert(
      fc.property(componentArb, (id) => {
        const reached = reachableFrom(EDGES, [id]);
        expect(reached.has('REWARD')).toBe(true);
      }),
      RUNS,
    );
  });
});

/** Property 8: credit conservation. */
describe('Property 8: credit conservation', () => {
  it('credit plus residual equals the total delta', () => {
    fc.assert(
      fc.property(agentIdArb, agentIdArb, (from, to) => {
        const r = computeAttribution(INITIAL_MODEL, from, to);
        if (!r.ok) return;
        const flow = computeCreditFlow(r.value, EDGES);
        const total = flow.entries.reduce((s, e) => s + e.credit, 0);
        for (const e of flow.entries) expect(Number.isFinite(e.credit)).toBe(true);
        expect(Math.abs(total + flow.residual - flow.totalDelta)).toBeLessThanOrEqual(1e-6);
      }),
      RUNS,
    );
  });

  it('conserves exactly for the canonical decomposition', () => {
    const flow = computeCreditFlow(ATTRIBUTION, EDGES);
    const total = flow.entries.reduce((s, e) => s + e.credit, 0);
    expect(Math.abs(total + flow.residual - flow.totalDelta)).toBeLessThanOrEqual(TOL);
  });
});

/** Property 12: lineage invariants. */
describe('Property 12: lineage invariants', () => {
  it('unique ids, one parent, generation = parent + 1, no self ancestry', () => {
    const ids = LINEAGE.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);

    const roots = LINEAGE.filter((a) => a.parent === null);
    expect(roots).toHaveLength(1);
    expect(roots[0]?.generation).toBe(0);

    for (const record of LINEAGE) {
      expect(Number.isInteger(record.generation)).toBe(true);
      expect(record.generation).toBeGreaterThanOrEqual(0);
      expect(record.generation).toBeLessThanOrEqual(64);
      if (record.parent === null) continue;
      const parent = LINEAGE.find((a) => a.id === record.parent);
      expect(parent).toBeDefined();
      expect(record.generation).toBe((parent?.generation ?? -1) + 1);

      // no self ancestry
      const seen = new Set<string>([record.id]);
      let cursor = parent;
      while (cursor) {
        expect(seen.has(cursor.id)).toBe(false);
        seen.add(cursor.id);
        cursor = LINEAGE.find((a) => a.id === cursor?.parent);
      }
    }
  });
});

/** Property 17: totality on invalid input. */
describe('Property 17: totality on invalid input', () => {
  it('unknown identifiers fail without throwing and without mutation', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (component, version) => {
        const before = JSON.stringify(INITIAL_MODEL);
        const known = (COMPONENT_IDS as readonly string[]).includes(component);

        const a = applyIntervention(INITIAL_MODEL, {
          component: component as ComponentId,
          version,
        });
        if (!known) expect(a.ok).toBe(false);

        const c = deriveCounterfactual(INITIAL_MODEL, component as ComponentId);
        if (!known) expect(c.ok).toBe(false);

        const t = computeAttribution(INITIAL_MODEL, component, version);
        expect(t.ok).toBe(false);

        expect(JSON.stringify(INITIAL_MODEL)).toBe(before);
      }),
      RUNS,
    );
  });
});
