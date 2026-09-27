/**
 * Deterministic graph layout. Same seed plus same model plus same viewport gives byte-identical
 * coordinates. No randomness, no clock, no locale.
 */

import type { CausalEdge, ComponentId, ComponentNode } from './causalSimulation';

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface LayoutNode {
  readonly id: ComponentId;
  readonly position: Vec3;
  /** Stable index into instanced attribute buffers. */
  readonly index: number;
}

export interface Layout {
  readonly nodes: readonly LayoutNode[];
  readonly byId: Readonly<Record<string, Vec3>>;
  readonly extent: number;
}

export interface LayoutOptions {
  readonly seed: number;
  /** Viewport aspect ratio, used to compress the flow axis on narrow screens. */
  readonly aspect: number;
}

export const DEFAULT_SEED = 0x43525349; // "CRSI"

/** Deterministic 32-bit hash, used instead of a PRNG so order cannot affect output. */
function hash(seed: number, key: string): number {
  let h = seed | 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (h ^ key.charCodeAt(i)) | 0;
    h = (h + ((h << 5) | 0)) | 0;
  }
  // Map to [-1, 1) with a fixed quantum so results are exactly reproducible.
  const q = ((h >>> 0) % 20001) / 10000 - 1;
  return q;
}

const FLOW_SPAN = 6.6;
const FAN_SPAN = 3.5;

/**
 * Nodes are placed by topological depth along the flow axis, spread across the fan axis by a
 * deterministic hash of their id, and pushed off the mid-plane by their outgoing weight so that
 * heavy causal routes sit closer to the viewer.
 */
export function layoutGraph(
  nodes: readonly ComponentNode[],
  edges: readonly CausalEdge[],
  options: LayoutOptions = { seed: DEFAULT_SEED, aspect: 16 / 9 },
): Layout {
  const maxDepth = nodes.reduce((m, n) => Math.max(m, n.depth), 0) || 1;
  const compress = options.aspect < 1 ? 0.62 : 1;

  const outWeight = (id: ComponentId): number =>
    edges.filter((e) => e.from === id).reduce((a, e) => a + Math.abs(e.weight), 0);
  const maxOut = nodes.reduce((m, n) => Math.max(m, outWeight(n.id)), 0) || 1;

  const perDepth = new Map<number, ComponentId[]>();
  for (const n of nodes) {
    const list = perDepth.get(n.depth) ?? [];
    list.push(n.id);
    perDepth.set(n.depth, list);
  }

  const laid = nodes.map((node, index) => {
    const siblings = perDepth.get(node.depth) ?? [node.id];
    const slot = siblings.indexOf(node.id);
    const spread = siblings.length === 1 ? 0 : slot / (siblings.length - 1) - 0.5;

    const x = (node.depth / maxDepth - 0.5) * FLOW_SPAN * compress;
    const y = spread * FAN_SPAN * 0.78 + hash(options.seed, `${node.id}:y`) * 0.34;
    const z = (outWeight(node.id) / maxOut - 0.5) * 1.9 + hash(options.seed, `${node.id}:z`) * 0.22;

    return { id: node.id, index, position: { x, y, z } } satisfies LayoutNode;
  });

  const byId: Record<string, Vec3> = {};
  for (const n of laid) byId[n.id] = n.position;

  const extent = laid.reduce((m, n) => {
    const r = Math.hypot(n.position.x, n.position.y, n.position.z);
    return Math.max(m, r);
  }, 0);

  return { nodes: laid, byId, extent };
}

/** Evolution-tree layout: generation on the flow axis, siblings spread on the fan axis. */
export function layoutTree(
  records: readonly { readonly id: string; readonly generation: number }[],
): Readonly<Record<string, Vec3>> {
  const maxGen = records.reduce((m, r) => Math.max(m, r.generation), 0) || 1;
  const perGen = new Map<number, string[]>();
  for (const r of records) {
    const list = perGen.get(r.generation) ?? [];
    list.push(r.id);
    perGen.set(r.generation, list);
  }

  const out: Record<string, Vec3> = {};
  for (const r of records) {
    const siblings = perGen.get(r.generation) ?? [r.id];
    const slot = siblings.indexOf(r.id);
    const spread = siblings.length === 1 ? 0 : slot / (siblings.length - 1) - 0.5;
    out[r.id] = {
      x: spread * FAN_SPAN * 1.35,
      y: (0.5 - r.generation / maxGen) * FLOW_SPAN * 0.78,
      z: hash(DEFAULT_SEED, `${r.id}:tz`) * 0.4,
    };
  }
  return out;
}

export function midpoint(a: Vec3, b: Vec3): Vec3 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}
