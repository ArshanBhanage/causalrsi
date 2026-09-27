/**
 * The deterministic demo model behind the Causal Observatory.
 *
 * Pure TypeScript. No DOM, no Three.js, no clock, no randomness, no locale.
 * Every operation returns a frozen value and never throws; invalid identifiers come back as
 * `{ ok: false, rejected }`.
 *
 * ALL NUMERIC VALUES HERE ARE ILLUSTRATIVE SIMULATION VALUES. They are not experimental results.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComponentId =
  | 'PROMPT'
  | 'MEMORY'
  | 'RETRIEVER'
  | 'PLANNER'
  | 'REASONING'
  | 'TOOLS'
  | 'EVALUATOR'
  | 'REWARD';

export type Archetype =
  | 'planes'
  | 'traces'
  | 'fan'
  | 'branches'
  | 'lattice'
  | 'satellites'
  | 'converging'
  | 'endpoint';

export type EdgeKind = 'strong' | 'weak' | 'correlated';

export interface ComponentNode {
  readonly id: ComponentId;
  readonly archetype: Archetype;
  /** Topological rank; drives layout along the flow axis. */
  readonly depth: number;
  /** Can the visitor intervene here? */
  readonly mutable: boolean;
  /** Idle motion period in seconds. Distinct per type by at least 0.5s. */
  readonly idlePeriod: number;
}

export interface CausalEdge {
  readonly id: string;
  readonly from: ComponentId;
  readonly to: ComponentId;
  /** [-1, 1], three decimal places. */
  readonly weight: number;
  readonly kind: EdgeKind;
}

export interface AgentVersion {
  readonly id: string;
  readonly parent: string | null;
  readonly generation: number;
  readonly versions: Readonly<Record<ComponentId, string>>;
  /** [0, 1], three decimal places. ILLUSTRATIVE. */
  readonly score: number;
}

export interface Contribution {
  readonly component: ComponentId;
  readonly value: number;
}

export interface Interaction {
  readonly pair: readonly [ComponentId, ComponentId];
  readonly value: number;
}

export interface AttributionSet {
  readonly from: string;
  readonly to: string;
  readonly totalDelta: number;
  readonly contributions: readonly Contribution[];
  readonly interactions: readonly Interaction[];
  /** totalDelta - sum(contributions) - sum(interactions) */
  readonly residual: number;
}

export interface CreditEntry {
  readonly component: ComponentId;
  readonly credit: number;
  /** Edge ids, ordered backward from REWARD. */
  readonly path: readonly string[];
}

export interface CreditFlow {
  readonly entries: readonly CreditEntry[];
  readonly residual: number;
  readonly totalDelta: number;
}

export interface Intervention {
  readonly component: ComponentId;
  readonly version: string;
}

export interface CounterfactualWorld {
  readonly removed: ComponentId;
  readonly factualId: string;
  readonly counterfactualId: string;
  readonly factualScore: number;
  readonly counterfactualScore: number;
  /** factualScore - counterfactualScore */
  readonly attributedEffect: number;
}

export interface ObservatoryModel {
  readonly nodes: readonly ComponentNode[];
  readonly edges: readonly CausalEdge[];
  readonly baseline: AgentVersion;
  readonly factual: AgentVersion;
  readonly applied: readonly Intervention[];
  readonly lineage: readonly AgentVersion[];
}

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string; readonly rejected: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(error: string, rejected: string): Result<T> => ({
  ok: false,
  error,
  rejected,
});

// ---------------------------------------------------------------------------
// Deep freeze
// ---------------------------------------------------------------------------

export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

export const NODES: readonly ComponentNode[] = deepFreeze([
  { id: 'PROMPT', archetype: 'planes', depth: 0, mutable: true, idlePeriod: 7.0 },
  { id: 'MEMORY', archetype: 'traces', depth: 0, mutable: true, idlePeriod: 4.5 },
  { id: 'RETRIEVER', archetype: 'fan', depth: 1, mutable: true, idlePeriod: 9.0 },
  { id: 'PLANNER', archetype: 'branches', depth: 2, mutable: true, idlePeriod: 6.0 },
  { id: 'REASONING', archetype: 'lattice', depth: 3, mutable: false, idlePeriod: 11.0 },
  { id: 'TOOLS', archetype: 'satellites', depth: 3, mutable: false, idlePeriod: 5.5 },
  { id: 'EVALUATOR', archetype: 'converging', depth: 4, mutable: false, idlePeriod: 8.0 },
  { id: 'REWARD', archetype: 'endpoint', depth: 5, mutable: false, idlePeriod: 2.5 },
]);

export const EDGES: readonly CausalEdge[] = deepFreeze([
  { id: 'EDGE_001', from: 'PROMPT', to: 'PLANNER', weight: 0.32, kind: 'strong' },
  { id: 'EDGE_002', from: 'PROMPT', to: 'REASONING', weight: 0.18, kind: 'weak' },
  { id: 'EDGE_003', from: 'MEMORY', to: 'RETRIEVER', weight: 0.41, kind: 'strong' },
  { id: 'EDGE_004', from: 'MEMORY', to: 'PLANNER', weight: 0.47, kind: 'strong' },
  { id: 'EDGE_005', from: 'RETRIEVER', to: 'PLANNER', weight: 0.24, kind: 'weak' },
  { id: 'EDGE_006', from: 'RETRIEVER', to: 'REASONING', weight: 0.15, kind: 'correlated' },
  { id: 'EDGE_007', from: 'PLANNER', to: 'REASONING', weight: 0.38, kind: 'strong' },
  { id: 'EDGE_008', from: 'PLANNER', to: 'TOOLS', weight: 0.52, kind: 'strong' },
  { id: 'EDGE_009', from: 'REASONING', to: 'TOOLS', weight: 0.29, kind: 'weak' },
  { id: 'EDGE_010', from: 'REASONING', to: 'EVALUATOR', weight: 0.33, kind: 'strong' },
  { id: 'EDGE_011', from: 'TOOLS', to: 'EVALUATOR', weight: 0.45, kind: 'strong' },
  { id: 'EDGE_012', from: 'EVALUATOR', to: 'REWARD', weight: 0.61, kind: 'strong' },
  { id: 'EDGE_013', from: 'TOOLS', to: 'REWARD', weight: 0.22, kind: 'weak' },
  { id: 'EDGE_014', from: 'MEMORY', to: 'REASONING', weight: 0.09, kind: 'correlated' },
]);

export const COMPONENT_IDS: readonly ComponentId[] = deepFreeze(NODES.map((n) => n.id));

/** The four components the visitor may intervene on. */
export const MUTABLE_IDS: readonly ComponentId[] = deepFreeze(
  NODES.filter((n) => n.mutable).map((n) => n.id),
);

// ---------------------------------------------------------------------------
// Agent versions
// ---------------------------------------------------------------------------

const V_0042: Readonly<Record<ComponentId, string>> = deepFreeze({
  PROMPT: 'v05',
  MEMORY: 'v03',
  RETRIEVER: 'v11',
  PLANNER: 'v07',
  REASONING: 'v04',
  TOOLS: 'v02',
  EVALUATOR: 'v01',
  REWARD: 'v01',
});

const V_0043: Readonly<Record<ComponentId, string>> = deepFreeze({
  PROMPT: 'v06',
  MEMORY: 'v04',
  RETRIEVER: 'v12',
  PLANNER: 'v08',
  REASONING: 'v04',
  TOOLS: 'v02',
  EVALUATOR: 'v01',
  REWARD: 'v01',
});

export const AGENT_0042: AgentVersion = deepFreeze({
  id: 'AGENT_0042',
  parent: null,
  generation: 0,
  versions: V_0042,
  score: 0.714,
});

export const AGENT_0043: AgentVersion = deepFreeze({
  id: 'AGENT_0043',
  parent: 'AGENT_0042',
  generation: 1,
  versions: V_0043,
  score: 0.842,
});

/**
 * The evolution tree shown in Scene RECURSION. AGENT_0043A is AGENT_0043 under its tree alias,
 * which is what lets the tree-to-graph morph reuse the same geometry instances.
 */
export const LINEAGE: readonly AgentVersion[] = deepFreeze([
  AGENT_0042,
  { id: 'AGENT_0043A', parent: 'AGENT_0042', generation: 1, versions: V_0043, score: 0.842 },
  {
    id: 'AGENT_0043B',
    parent: 'AGENT_0042',
    generation: 1,
    versions: { ...V_0043, PLANNER: 'v07', RETRIEVER: 'v11' },
    score: 0.769,
  },
  {
    id: 'AGENT_0043C',
    parent: 'AGENT_0042',
    generation: 1,
    versions: { ...V_0042, PROMPT: 'v07' },
    score: 0.688,
  },
  {
    id: 'AGENT_0044A',
    parent: 'AGENT_0043A',
    generation: 2,
    versions: { ...V_0043, MEMORY: 'v05' },
    score: 0.871,
  },
  {
    id: 'AGENT_0044B',
    parent: 'AGENT_0043B',
    generation: 2,
    versions: { ...V_0043, TOOLS: 'v03' },
    score: 0.804,
  },
  {
    id: 'AGENT_0045',
    parent: 'AGENT_0044A',
    generation: 3,
    versions: { ...V_0043, MEMORY: 'v05', PLANNER: 'v09' },
    score: 0.903,
  },
]);

// ---------------------------------------------------------------------------
// Attribution — ILLUSTRATIVE
// ---------------------------------------------------------------------------

const CONTRIBUTIONS: readonly Contribution[] = deepFreeze([
  { component: 'PROMPT', value: 0.01 },
  { component: 'MEMORY', value: 0.07 },
  { component: 'PLANNER', value: 0.04 },
  { component: 'RETRIEVER', value: -0.01 },
]);

const INTERACTIONS: readonly Interaction[] = deepFreeze([
  { pair: ['MEMORY', 'PLANNER'], value: 0.05 },
]);

const round = (n: number, dp = 9): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

const sum = (ns: readonly number[]): number => ns.reduce((a, b) => a + b, 0);

/**
 * The stated contributions sum to +0.16 while the total delta is +0.128. The gap is carried
 * openly as a residual of -0.032 rather than hidden by retuning the demo numbers — a
 * decomposition that does not close is the honest case, and it makes closure exactly checkable.
 */
export const ATTRIBUTION: AttributionSet = deepFreeze({
  from: AGENT_0042.id,
  to: AGENT_0043.id,
  totalDelta: round(AGENT_0043.score - AGENT_0042.score),
  contributions: CONTRIBUTIONS,
  interactions: INTERACTIONS,
  residual: round(
    AGENT_0043.score -
      AGENT_0042.score -
      sum(CONTRIBUTIONS.map((c) => c.value)) -
      sum(INTERACTIONS.map((i) => i.value)),
  ),
});

/** Path class per modified component, used by Scene ATTRIBUTION. */
export const PATH_CLASS: Readonly<Record<string, EdgeKind>> = deepFreeze({
  MEMORY: 'strong',
  PLANNER: 'strong',
  PROMPT: 'weak',
  RETRIEVER: 'correlated',
});

/** Illustrative confidence per modification, rendered as `CONF / .NN`. */
export const CONFIDENCE: Readonly<Record<string, number>> = deepFreeze({
  MEMORY: 0.91,
  PLANNER: 0.78,
  PROMPT: 0.44,
  RETRIEVER: 0.29,
});

// ---------------------------------------------------------------------------
// Counterfactuals — ILLUSTRATIVE
// ---------------------------------------------------------------------------

/**
 * Scores under `do(X = baseline)`. Stored explicitly so that
 * `factual - counterfactual = attributedEffect` holds exactly rather than by arithmetic luck.
 * MEMORY's effect is close to its main effect because part of its value is conditional on
 * PLANNER through the interaction term.
 */
const COUNTERFACTUAL_SCORES: Readonly<Partial<Record<ComponentId, number>>> = deepFreeze({
  MEMORY: 0.773,
  PLANNER: 0.802,
  PROMPT: 0.832,
  RETRIEVER: 0.852,
});

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const INITIAL_MODEL: ObservatoryModel = deepFreeze({
  nodes: NODES,
  edges: EDGES,
  baseline: AGENT_0042,
  factual: AGENT_0043,
  applied: [] as readonly Intervention[],
  lineage: LINEAGE,
});

const isComponentId = (v: string): v is ComponentId =>
  (COMPONENT_IDS as readonly string[]).includes(v);

const nextVersionOf = (current: string): string => {
  const m = /^v(\d+)$/.exec(current);
  if (!m || m[1] === undefined) return current;
  const n = Number.parseInt(m[1], 10) + 1;
  return `v${String(n).padStart(2, '0')}`;
};

/** The version an intervention on `component` would move to, or null if none is available. */
export function availableVersion(
  model: ObservatoryModel,
  component: ComponentId,
): string | null {
  const node = model.nodes.find((n) => n.id === component);
  if (!node || !node.mutable) return null;
  const baseline = model.baseline.versions[component];
  const factual = model.factual.versions[component];
  if (baseline !== factual) return factual;
  const next = nextVersionOf(factual);
  return next === factual ? null : next;
}

/**
 * `do(component = version)`. Idempotent: the applied list is keyed by component, so applying the
 * same intervention twice yields a state equal by value to applying it once.
 */
export function applyIntervention(
  model: ObservatoryModel,
  intervention: Intervention,
): Result<ObservatoryModel> {
  if (!isComponentId(intervention.component)) {
    return fail('unknown component', String(intervention.component));
  }
  const node = model.nodes.find((n) => n.id === intervention.component);
  if (!node) return fail('unknown component', intervention.component);
  if (!node.mutable) return fail('component is not intervenable', intervention.component);

  const allowed = availableVersion(model, intervention.component);
  if (allowed === null || intervention.version !== allowed) {
    return fail('unknown component version', intervention.version);
  }

  const applied = [
    ...model.applied.filter((i) => i.component !== intervention.component),
    { component: intervention.component, version: intervention.version },
  ].sort((a, b) => a.component.localeCompare(b.component));

  return ok(deepFreeze({ ...model, applied }));
}

/** Returns the model to its initial state. `reset(apply(s, i))` is deep-equal to `s`. */
export function reset(model: ObservatoryModel): ObservatoryModel {
  void model;
  return INITIAL_MODEL;
}

/**
 * The score the agent would have reached with `component` held at its baseline version.
 * Does not mutate the factual model.
 */
export function deriveCounterfactual(
  model: ObservatoryModel,
  removed: ComponentId,
): Result<CounterfactualWorld> {
  if (!isComponentId(removed)) return fail('unknown component', String(removed));
  const score = COUNTERFACTUAL_SCORES[removed];
  if (score === undefined) {
    return fail('no counterfactual defined for component', removed);
  }
  const factualScore = model.factual.score;
  return ok(
    deepFreeze({
      removed,
      factualId: model.factual.id,
      counterfactualId: `${model.factual.id}'`,
      factualScore,
      counterfactualScore: score,
      attributedEffect: round(factualScore - score),
    }),
  );
}

/** Components whose version differs between two agent versions. */
export function changedComponents(
  a: AgentVersion,
  b: AgentVersion,
): readonly ComponentId[] {
  return COMPONENT_IDS.filter((id) => a.versions[id] !== b.versions[id]);
}

export function computeAttribution(
  model: ObservatoryModel,
  fromId: string,
  toId: string,
): Result<AttributionSet> {
  const all = [model.baseline, model.factual, ...model.lineage];
  const from = all.find((a) => a.id === fromId);
  if (!from) return fail('unknown agent version', fromId);
  const to = all.find((a) => a.id === toId);
  if (!to) return fail('unknown agent version', toId);

  const totalDelta = round(to.score - from.score);
  const changed = changedComponents(from, to);

  if (changed.length === 0) {
    return ok(
      deepFreeze({
        from: fromId,
        to: toId,
        totalDelta: 0,
        contributions: [] as readonly Contribution[],
        interactions: [] as readonly Interaction[],
        residual: 0,
      }),
    );
  }

  // The canonical 0042 -> 0043 decomposition is the authored illustrative one.
  if (from.id === AGENT_0042.id && to.versions === V_0043) {
    return ok(deepFreeze({ ...ATTRIBUTION, from: fromId, to: toId, totalDelta }));
  }

  // Any other pair: distribute the delta over the changed components in proportion to the
  // total outgoing edge weight of each, then carry the rounding gap as residual.
  const weightOf = (id: ComponentId): number =>
    sum(model.edges.filter((e) => e.from === id).map((e) => Math.abs(e.weight)));
  const totalWeight = sum(changed.map(weightOf));
  const contributions: Contribution[] = changed.map((id) => ({
    component: id,
    value:
      totalWeight === 0
        ? round(totalDelta / changed.length, 6)
        : round((totalDelta * weightOf(id)) / totalWeight, 6),
  }));

  const residual = round(totalDelta - sum(contributions.map((c) => c.value)));

  return ok(
    deepFreeze({
      from: fromId,
      to: toId,
      totalDelta,
      contributions,
      interactions: [] as readonly Interaction[],
      residual,
    }),
  );
}

/** Highest-weight directed path between two components, as edge ids. Empty if unreachable. */
export function tracePath(
  edges: readonly CausalEdge[],
  from: ComponentId,
  to: ComponentId,
): readonly string[] {
  if (from === to) return [];
  // Best-first over a DAG; weights are positive so a simple greedy frontier suffices.
  const best = new Map<ComponentId, { score: number; path: readonly string[] }>();
  best.set(from, { score: 0, path: [] });
  const queue: ComponentId[] = [from];

  while (queue.length > 0) {
    const current = queue.shift() as ComponentId;
    const here = best.get(current);
    if (!here) continue;
    for (const edge of edges) {
      if (edge.from !== current) continue;
      const candidate = { score: here.score + Math.abs(edge.weight), path: [...here.path, edge.id] };
      const existing = best.get(edge.to);
      if (!existing || candidate.score > existing.score) {
        best.set(edge.to, candidate);
        queue.push(edge.to);
      }
    }
  }

  return best.get(to)?.path ?? [];
}

/**
 * Credit flows backward from REWARD. Each contribution is carried along the highest-weight path
 * from its component to REWARD. Interaction terms are recorded separately and split evenly for
 * display intensity, so no credit is double counted and
 * `sum(credit) + residual = totalDelta` holds exactly.
 */
export function computeCreditFlow(
  attribution: AttributionSet,
  edges: readonly CausalEdge[],
): CreditFlow {
  const perComponent = new Map<ComponentId, number>();
  for (const c of attribution.contributions) {
    perComponent.set(c.component, (perComponent.get(c.component) ?? 0) + c.value);
  }
  for (const i of attribution.interactions) {
    const half = i.value / 2;
    const [a, b] = i.pair;
    perComponent.set(a, (perComponent.get(a) ?? 0) + half);
    perComponent.set(b, (perComponent.get(b) ?? 0) + half);
  }

  const entries: CreditEntry[] = [...perComponent.entries()]
    .map(([component, credit]) => ({
      component,
      credit: round(credit),
      path: [...tracePath(edges, component, 'REWARD')].reverse(),
    }))
    .sort((x, y) => Math.abs(y.credit) - Math.abs(x.credit));

  return deepFreeze({
    entries,
    residual: attribution.residual,
    totalDelta: attribution.totalDelta,
  });
}

// ---------------------------------------------------------------------------
// Topology helpers, used by the scenes and by the property tests
// ---------------------------------------------------------------------------

export function sinkNodes(
  nodes: readonly ComponentNode[],
  edges: readonly CausalEdge[],
): readonly ComponentId[] {
  return nodes.filter((n) => !edges.some((e) => e.from === n.id)).map((n) => n.id);
}

export function sourceNodes(
  nodes: readonly ComponentNode[],
  edges: readonly CausalEdge[],
): readonly ComponentId[] {
  return nodes.filter((n) => !edges.some((e) => e.to === n.id)).map((n) => n.id);
}

export function hasCycle(
  nodes: readonly ComponentNode[],
  edges: readonly CausalEdge[],
): boolean {
  const state = new Map<ComponentId, 0 | 1 | 2>();
  for (const n of nodes) state.set(n.id, 0);

  const visit = (id: ComponentId): boolean => {
    const s = state.get(id);
    if (s === 1) return true;
    if (s === 2) return false;
    state.set(id, 1);
    for (const e of edges) {
      if (e.from === id && visit(e.to)) return true;
    }
    state.set(id, 2);
    return false;
  };

  return nodes.some((n) => visit(n.id));
}

export function reachableFrom(
  edges: readonly CausalEdge[],
  roots: readonly ComponentId[],
): ReadonlySet<ComponentId> {
  const seen = new Set<ComponentId>(roots);
  const queue = [...roots];
  while (queue.length > 0) {
    const current = queue.shift() as ComponentId;
    for (const e of edges) {
      if (e.from === current && !seen.has(e.to)) {
        seen.add(e.to);
        queue.push(e.to);
      }
    }
  }
  return seen;
}

/** Causal ancestors and descendants of a node, used for selection dimming. */
export function relatives(
  edges: readonly CausalEdge[],
  id: ComponentId,
): ReadonlySet<ComponentId> {
  const down = reachableFrom(edges, [id]);
  const reversed = edges.map((e) => ({ ...e, from: e.to, to: e.from }));
  const up = reachableFrom(reversed, [id]);
  return new Set<ComponentId>([...down, ...up]);
}

export const SCORE_DP = 3 as const;

export function formatScore(n: number): string {
  return n.toFixed(SCORE_DP);
}

export function formatDelta(n: number, dp = 3): string {
  const s = n.toFixed(dp);
  return n >= 0 ? `+${s}` : s;
}

export function formatPercent(from: number, to: number): string {
  if (from === 0) return '+0.0%';
  const pct = ((to - from) / from) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}
