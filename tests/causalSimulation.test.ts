import { describe, expect, it } from 'vitest';
import {
  AGENT_0042,
  AGENT_0043,
  ATTRIBUTION,
  COMPONENT_IDS,
  EDGES,
  INITIAL_MODEL,
  MUTABLE_IDS,
  NODES,
  applyIntervention,
  availableVersion,
  changedComponents,
  computeAttribution,
  computeCreditFlow,
  deriveCounterfactual,
  formatDelta,
  formatPercent,
  formatScore,
  hasCycle,
  relatives,
  reset,
  sinkNodes,
  sourceNodes,
  tracePath,
} from '@/lib/causalSimulation';

describe('graph shape', () => {
  it('has eight nodes and fourteen edges', () => {
    expect(NODES).toHaveLength(8);
    expect(EDGES).toHaveLength(14);
  });

  it('is acyclic with REWARD as the only sink', () => {
    expect(hasCycle(NODES, EDGES)).toBe(false);
    expect(sinkNodes(NODES, EDGES)).toEqual(['REWARD']);
  });

  it('has PROMPT and MEMORY as sources', () => {
    expect([...sourceNodes(NODES, EDGES)].sort()).toEqual(['MEMORY', 'PROMPT']);
  });

  it('exposes exactly four mutable components', () => {
    expect([...MUTABLE_IDS].sort()).toEqual(['MEMORY', 'PLANNER', 'PROMPT', 'RETRIEVER']);
  });
});

describe('agent versions', () => {
  it('scores the two canonical agents', () => {
    expect(AGENT_0042.score).toBe(0.714);
    expect(AGENT_0043.score).toBe(0.842);
  });

  it('changes exactly four components between them', () => {
    expect([...changedComponents(AGENT_0042, AGENT_0043)].sort()).toEqual([
      'MEMORY',
      'PLANNER',
      'PROMPT',
      'RETRIEVER',
    ]);
  });
});

describe('attribution', () => {
  it('carries the residual openly', () => {
    expect(ATTRIBUTION.totalDelta).toBeCloseTo(0.128, 9);
    expect(ATTRIBUTION.residual).toBeCloseTo(-0.032, 9);
  });

  it('closes exactly', () => {
    const contrib = ATTRIBUTION.contributions.reduce((a, c) => a + c.value, 0);
    const inter = ATTRIBUTION.interactions.reduce((a, i) => a + i.value, 0);
    expect(ATTRIBUTION.totalDelta - contrib - inter - ATTRIBUTION.residual).toBeCloseTo(0, 9);
  });

  it('rejects unknown agent identifiers without throwing', () => {
    const r = computeAttribution(INITIAL_MODEL, 'AGENT_9999', AGENT_0043.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejected).toBe('AGENT_9999');
  });

  it('returns a zero decomposition for an identical pair', () => {
    const r = computeAttribution(INITIAL_MODEL, AGENT_0042.id, AGENT_0042.id);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.totalDelta).toBe(0);
      expect(r.value.residual).toBe(0);
      expect(r.value.contributions).toHaveLength(0);
    }
  });
});

describe('interventions', () => {
  it('applies a valid intervention', () => {
    const version = availableVersion(INITIAL_MODEL, 'MEMORY');
    expect(version).toBe('v04');
    const r = applyIntervention(INITIAL_MODEL, { component: 'MEMORY', version: 'v04' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.applied).toHaveLength(1);
  });

  it('leaves the input model untouched', () => {
    const before = JSON.stringify(INITIAL_MODEL);
    applyIntervention(INITIAL_MODEL, { component: 'MEMORY', version: 'v04' });
    expect(JSON.stringify(INITIAL_MODEL)).toBe(before);
  });

  it('rejects a non-intervenable component', () => {
    const r = applyIntervention(INITIAL_MODEL, { component: 'REWARD', version: 'v02' });
    expect(r.ok).toBe(false);
  });

  it('rejects an unknown version', () => {
    const r = applyIntervention(INITIAL_MODEL, { component: 'MEMORY', version: 'v99' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejected).toBe('v99');
  });

  it('resets to the initial model', () => {
    const r = applyIntervention(INITIAL_MODEL, { component: 'MEMORY', version: 'v04' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(reset(r.value)).toEqual(INITIAL_MODEL);
  });
});

describe('counterfactuals', () => {
  it('reports the illustrative memory counterfactual', () => {
    const r = deriveCounterfactual(INITIAL_MODEL, 'MEMORY');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.counterfactualScore).toBe(0.773);
      expect(r.value.attributedEffect).toBeCloseTo(0.069, 9);
      expect(r.value.counterfactualId).toBe("AGENT_0043'");
    }
  });

  it('has no counterfactual for an unmodified component', () => {
    const r = deriveCounterfactual(INITIAL_MODEL, 'TOOLS');
    expect(r.ok).toBe(false);
  });
});

describe('paths and credit', () => {
  it('traces a path from memory to reward', () => {
    const path = tracePath(EDGES, 'MEMORY', 'REWARD');
    expect(path.length).toBeGreaterThan(0);
    expect(path[0]).toMatch(/^EDGE_/);
  });

  it('returns an empty path for a node to itself', () => {
    expect(tracePath(EDGES, 'MEMORY', 'MEMORY')).toEqual([]);
  });

  it('conserves credit', () => {
    const flow = computeCreditFlow(ATTRIBUTION, EDGES);
    const total = flow.entries.reduce((a, e) => a + e.credit, 0);
    expect(total + flow.residual).toBeCloseTo(flow.totalDelta, 9);
  });

  it('orders credit by magnitude', () => {
    const flow = computeCreditFlow(ATTRIBUTION, EDGES);
    const magnitudes = flow.entries.map((e) => Math.abs(e.credit));
    const sorted = [...magnitudes].sort((a, b) => b - a);
    expect(magnitudes).toEqual(sorted);
  });

  it('includes ancestors and descendants in relatives', () => {
    const set = relatives(EDGES, 'PLANNER');
    expect(set.has('MEMORY')).toBe(true);
    expect(set.has('REWARD')).toBe(true);
  });
});

describe('formatting', () => {
  it('renders scores to three decimals', () => {
    expect(formatScore(0.7)).toBe('0.700');
  });

  it('signs deltas', () => {
    expect(formatDelta(0.128)).toBe('+0.128');
    expect(formatDelta(-0.01, 2)).toBe('-0.01');
  });

  it('computes the hero percentage', () => {
    expect(formatPercent(0.714, 0.842)).toBe('+17.9%');
  });
});

describe('component ids', () => {
  it('lists all eight', () => {
    expect(COMPONENT_IDS).toHaveLength(8);
  });
});
