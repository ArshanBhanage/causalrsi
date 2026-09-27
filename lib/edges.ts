/**
 * Edge curve sampling. Pure so the renderer can rebuild buffers deterministically.
 */

import type { CausalEdge } from './causalSimulation';
import type { Vec3 } from './graphLayout';

export interface EdgeSample {
  readonly edgeIndex: number;
  /** Position along the curve, 0 at source, 1 at target. */
  readonly t: number;
  readonly point: Vec3;
}

const BOW = 0.13;

/** Quadratic bow so parallel routes separate instead of overlapping. */
export function edgePoint(from: Vec3, to: Vec3, t: number, bow: number): Vec3 {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2 + bow;
  const mz = (from.z + to.z) / 2 + bow * 0.4;
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * mx + t * t * to.x,
    y: u * u * from.y + 2 * u * t * my + t * t * to.y,
    z: u * u * from.z + 2 * u * t * mz + t * t * to.z,
  };
}

export function bowOf(edge: CausalEdge, index: number): number {
  const dir = index % 2 === 0 ? 1 : -1;
  const scale = edge.kind === 'correlated' ? 1.9 : edge.kind === 'weak' ? 1.25 : 0.7;
  return BOW * dir * scale;
}

export interface EdgeBuffers {
  readonly positions: Float32Array;
  readonly edgeIndex: Float32Array;
  readonly along: Float32Array;
  readonly kind: Float32Array;
  readonly weight: Float32Array;
  readonly vertexCount: number;
}

/** One line-strip per edge, emitted as segment pairs into a single buffer. */
export function buildEdgeBuffers(
  edges: readonly CausalEdge[],
  byId: Readonly<Record<string, Vec3>>,
  segments: number,
): EdgeBuffers {
  const steps = Math.max(2, segments);
  const perEdge = steps; // `steps` segments => `steps` pairs
  const total = edges.length * perEdge * 2;

  const positions = new Float32Array(total * 3);
  const edgeIndex = new Float32Array(total);
  const along = new Float32Array(total);
  const kind = new Float32Array(total);
  const weight = new Float32Array(total);

  const kindCode = { strong: 0, weak: 1, correlated: 2 } as const;

  let v = 0;
  edges.forEach((edge, ei) => {
    const from = byId[edge.from] ?? { x: 0, y: 0, z: 0 };
    const to = byId[edge.to] ?? { x: 0, y: 0, z: 0 };
    const bow = bowOf(edge, ei);
    for (let s = 0; s < steps; s += 1) {
      const t0 = s / steps;
      const t1 = (s + 1) / steps;
      const p0 = edgePoint(from, to, t0, bow);
      const p1 = edgePoint(from, to, t1, bow);
      positions[v * 3] = p0.x;
      positions[v * 3 + 1] = p0.y;
      positions[v * 3 + 2] = p0.z;
      edgeIndex[v] = ei;
      along[v] = t0;
      kind[v] = kindCode[edge.kind];
      weight[v] = edge.weight;
      v += 1;
      positions[v * 3] = p1.x;
      positions[v * 3 + 1] = p1.y;
      positions[v * 3 + 2] = p1.z;
      edgeIndex[v] = ei;
      along[v] = t1;
      kind[v] = kindCode[edge.kind];
      weight[v] = edge.weight;
      v += 1;
    }
  });

  return { positions, edgeIndex, along, kind, weight, vertexCount: total };
}

/** Screen-space distance helper used by the lens hit test. */
export function distance2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
