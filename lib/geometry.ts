/**
 * Archetype geometry, built as plain number arrays so it stays pure and testable.
 *
 * Every node's internal structure is emitted as line segments in local space. The renderer
 * merges all of them into one buffer, which is why the whole graph costs a handful of draw calls.
 */

import type { Archetype, ComponentId } from './causalSimulation';

export type Seg = readonly [number, number, number, number, number, number];

const TAU = Math.PI * 2;

/** Deterministic pseudo-noise; no RNG so geometry is byte-stable. */
function n(i: number, k: number): number {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s) - 0.5;
}

function planes(detail: number): Seg[] {
  const out: Seg[] = [];
  const count = Math.max(3, Math.round(6 * detail));
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1) - 0.5;
    const z = t * 0.5;
    const w = 0.42 - Math.abs(t) * 0.1;
    const h = 0.3 - Math.abs(t) * 0.06;
    const sk = t * 0.1;
    out.push(
      [-w + sk, -h, z, w + sk, -h, z],
      [w + sk, -h, z, w - sk, h, z],
      [w - sk, h, z, -w - sk, h, z],
      [-w - sk, h, z, -w + sk, -h, z],
    );
  }
  return out;
}

function traces(detail: number): Seg[] {
  const out: Seg[] = [];
  const rows = Math.max(4, Math.round(9 * detail));
  const cols = 9;
  for (let r = 0; r < rows; r += 1) {
    const y = (r / (rows - 1) - 0.5) * 0.62;
    const z = -r * 0.045;
    for (let c = 0; c < cols - 1; c += 1) {
      const x0 = (c / (cols - 1) - 0.5) * 0.82;
      const x1 = ((c + 1) / (cols - 1) - 0.5) * 0.82;
      const j0 = n(r * 31 + c, 1) * 0.055;
      const j1 = n(r * 31 + c + 1, 1) * 0.055;
      out.push([x0, y + j0, z, x1, y + j1, z]);
    }
  }
  return out;
}

function fan(detail: number): Seg[] {
  const out: Seg[] = [];
  const rays = Math.max(5, Math.round(12 * detail));
  for (let i = 0; i < rays; i += 1) {
    const a = (i / (rays - 1) - 0.5) * 1.5;
    const len = 0.5 + Math.cos(a) * 0.18;
    const x = Math.cos(a) * len;
    const y = Math.sin(a) * len;
    out.push([-0.38, 0, 0, x - 0.38, y, n(i, 3) * 0.1]);
    if (i > 0) {
      const pa = ((i - 1) / (rays - 1) - 0.5) * 1.5;
      const plen = 0.5 + Math.cos(pa) * 0.18;
      out.push([
        Math.cos(pa) * plen - 0.38,
        Math.sin(pa) * plen,
        n(i - 1, 3) * 0.1,
        x - 0.38,
        y,
        n(i, 3) * 0.1,
      ]);
    }
  }
  return out;
}

function branches(detail: number): Seg[] {
  const out: Seg[] = [];
  const levels = detail > 0.5 ? 3 : 2;

  const grow = (
    x: number,
    y: number,
    z: number,
    angle: number,
    len: number,
    level: number,
  ): void => {
    if (level > levels) return;
    const x2 = x + Math.cos(angle) * len;
    const y2 = y + Math.sin(angle) * len;
    const z2 = z + n(level * 7 + angle * 11, 5) * 0.07;
    out.push([x, y, z, x2, y2, z2]);
    const spread = 0.58 - level * 0.08;
    grow(x2, y2, z2, angle + spread, len * 0.66, level + 1);
    grow(x2, y2, z2, angle - spread, len * 0.66, level + 1);
  };

  grow(-0.52, 0, 0, 0, 0.5, 1);
  return out;
}

function lattice(detail: number): Seg[] {
  const out: Seg[] = [];
  const nx = detail > 0.5 ? 4 : 3;
  const ny = detail > 0.5 ? 4 : 3;
  const nz = 2;
  const at = (i: number, j: number, k: number): readonly [number, number, number] => [
    (i / (nx - 1) - 0.5) * 0.68,
    (j / (ny - 1) - 0.5) * 0.68,
    (k / Math.max(1, nz - 1) - 0.5) * 0.4,
  ];
  for (let i = 0; i < nx; i += 1) {
    for (let j = 0; j < ny; j += 1) {
      for (let k = 0; k < nz; k += 1) {
        if ((i + j + k) % 2 === 1) continue;
        const a = at(i, j, k);
        if (i + 1 < nx) {
          const b = at(i + 1, j, k);
          out.push([a[0], a[1], a[2], b[0], b[1], b[2]]);
        }
        if (j + 1 < ny) {
          const b = at(i, j + 1, k);
          out.push([a[0], a[1], a[2], b[0], b[1], b[2]]);
        }
        if (k + 1 < nz) {
          const b = at(i, j, k + 1);
          out.push([a[0], a[1], a[2], b[0], b[1], b[2]]);
        }
      }
    }
  }
  return out;
}

function satellites(detail: number): Seg[] {
  const out: Seg[] = [];
  const count = Math.max(3, Math.round(5 * detail));
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * TAU;
    const r = 0.26 + (i % 2) * 0.18;
    const cx = Math.cos(a) * r;
    const cy = Math.sin(a) * r * 0.7;
    const cz = n(i, 9) * 0.22;
    const s = 0.055;
    // small octahedron wireframe
    const pts: readonly (readonly [number, number, number])[] = [
      [cx + s, cy, cz],
      [cx - s, cy, cz],
      [cx, cy + s, cz],
      [cx, cy - s, cz],
      [cx, cy, cz + s],
      [cx, cy, cz - s],
    ];
    const pairs: readonly (readonly [number, number])[] = [
      [0, 2],
      [2, 1],
      [1, 3],
      [3, 0],
      [0, 4],
      [2, 4],
      [1, 4],
      [3, 4],
      [0, 5],
      [2, 5],
      [1, 5],
      [3, 5],
    ];
    for (const [a1, b1] of pairs) {
      const p = pts[a1];
      const q = pts[b1];
      if (p && q) out.push([p[0], p[1], p[2], q[0], q[1], q[2]]);
    }
  }
  return out;
}

function converging(detail: number): Seg[] {
  const out: Seg[] = [];
  const count = Math.max(4, Math.round(8 * detail));
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * TAU;
    const r = 0.44;
    out.push([Math.cos(a) * r, Math.sin(a) * r * 0.8, n(i, 11) * 0.2, 0.34, 0, 0]);
  }
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * TAU;
    const b = ((i + 1) / count) * TAU;
    const r = 0.44;
    out.push([
      Math.cos(a) * r,
      Math.sin(a) * r * 0.8,
      n(i, 11) * 0.2,
      Math.cos(b) * r,
      Math.sin(b) * r * 0.8,
      n(i + 1, 11) * 0.2,
    ]);
  }
  return out;
}

function endpoint(detail: number): Seg[] {
  const out: Seg[] = [];
  const count = Math.max(10, Math.round(26 * detail));
  for (let i = 0; i < count; i += 1) {
    const a = n(i, 13) * TAU;
    const b = n(i, 17) * Math.PI;
    const r = 0.06 + Math.abs(n(i, 19)) * 0.13;
    const x = Math.cos(a) * Math.sin(b) * r;
    const y = Math.sin(a) * Math.sin(b) * r;
    const z = Math.cos(b) * r;
    out.push([x * 0.4, y * 0.4, z * 0.4, x, y, z]);
  }
  return out;
}

const BUILDERS: Readonly<Record<Archetype, (detail: number) => Seg[]>> = {
  planes,
  traces,
  fan,
  branches,
  lattice,
  satellites,
  converging,
  endpoint,
};

export function buildArchetype(archetype: Archetype, detail = 1): readonly Seg[] {
  const build = BUILDERS[archetype];
  return build ? build(Math.min(Math.max(detail, 0.2), 1)) : [];
}

export interface MergedGeometry {
  /** xyz triplets, two per segment */
  readonly positions: Float32Array;
  /** node index per vertex */
  readonly nodeIndex: Float32Array;
  /** 0..1 local radius per vertex, used for lens falloff in the shader */
  readonly localRadius: Float32Array;
  readonly count: number;
}

export interface PlacedNode {
  readonly id: ComponentId;
  readonly archetype: Archetype;
  readonly index: number;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly scale: number;
}

/** Merge every node's archetype into one interleaved buffer in world space. */
export function mergeNodeGeometry(nodes: readonly PlacedNode[], detail = 1): MergedGeometry {
  const segments: { seg: Seg; index: number; radius: number }[] = [];

  for (const node of nodes) {
    const local = buildArchetype(node.archetype, detail);
    for (const s of local) {
      const scaled: Seg = [
        node.position.x + s[0] * node.scale,
        node.position.y + s[1] * node.scale,
        node.position.z + s[2] * node.scale,
        node.position.x + s[3] * node.scale,
        node.position.y + s[4] * node.scale,
        node.position.z + s[5] * node.scale,
      ];
      const radius = Math.min(1, Math.hypot(s[0], s[1], s[2]) / 0.6);
      segments.push({ seg: scaled, index: node.index, radius });
    }
  }

  const positions = new Float32Array(segments.length * 6);
  const nodeIndex = new Float32Array(segments.length * 2);
  const localRadius = new Float32Array(segments.length * 2);

  segments.forEach((entry, i) => {
    positions.set(entry.seg, i * 6);
    nodeIndex[i * 2] = entry.index;
    nodeIndex[i * 2 + 1] = entry.index;
    localRadius[i * 2] = entry.radius;
    localRadius[i * 2 + 1] = entry.radius;
  });

  return { positions, nodeIndex, localRadius, count: segments.length * 2 };
}
