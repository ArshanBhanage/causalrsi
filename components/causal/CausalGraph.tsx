'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  ATTRIBUTION,
  EDGES,
  NODES,
  PATH_CLASS,
  relatives,
  tracePath,
  type ComponentId,
} from '@/lib/causalSimulation';
import { buildEdgeBuffers, distance2, edgePoint, bowOf } from '@/lib/edges';
import { mergeNodeGeometry, type PlacedNode } from '@/lib/geometry';
import type { Layout, Vec3 } from '@/lib/graphLayout';
import { LENS_RADIUS_PX, stepSpring } from '@/lib/motion';
import { qualityProfile, useObservatory, type LensMode } from '@/lib/store';
import { pointer } from '@/hooks/usePointerLens';
import { publishScreenPoint } from '@/lib/projection';

const NODE_VERT = /* glsl */ `
  attribute float aNode;
  attribute float aRadius;
  uniform vec2 uLens;
  uniform float uLensRadius;
  uniform float uLensStrength;
  uniform float uTime;
  uniform float uAmbient;
  uniform float uPeriod[8];
  uniform vec3 uOffset[8];
  uniform float uOpacity[8];
  uniform float uHighlight[8];
  uniform float uNegativeMix[8];
  varying float vLens;
  varying float vRadius;
  varying float vOpacity;
  varying float vHighlight;
  varying float vNegative;

  void main() {
    vRadius = aRadius;
    int idx = int(aNode + 0.5);

    // Uniform arrays are read here, never in the fragment stage: GLSL ES 1.0 does not
    // guarantee dynamic indexing of uniform arrays in a fragment shader.
    vOpacity = uOpacity[idx];
    vHighlight = uHighlight[idx];
    vNegative = uNegativeMix[idx];

    vec3 p = position + uOffset[idx];

    float period = uPeriod[idx];
    float phase = uTime / max(period, 0.001) * 6.2831853;
    p.y += sin(phase) * 0.02 * uAmbient;
    p.z += cos(phase * 0.71) * 0.014 * uAmbient;

    vec4 clip = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
    vec2 ndc = clip.xy / max(abs(clip.w), 0.0001);
    float d = length(ndc - uLens) / max(uLensRadius, 0.0001);
    float fall = 1.0 - smoothstep(0.0, 1.0, d);
    vLens = fall;

    vec2 dir = normalize(ndc - uLens + vec2(0.00013, 0.00017));
    clip.xy += dir * fall * uLensStrength * 0.045 * abs(clip.w);

    gl_Position = clip;
  }
`;

const NODE_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uBase;
  uniform vec3 uAccent;
  uniform vec3 uNegative;
  varying float vLens;
  varying float vRadius;
  varying float vOpacity;
  varying float vHighlight;
  varying float vNegative;

  void main() {
    if (vOpacity < 0.01) discard;
    vec3 color = mix(uBase, uAccent, clamp(vHighlight + vLens * 0.45, 0.0, 1.0));
    color = mix(color, uNegative, vNegative);
    float alpha = vOpacity * (0.72 + vLens * 0.5) * (1.0 - vRadius * 0.22);
    gl_FragColor = vec4(color, alpha);
  }
`;

const EDGE_VERT = /* glsl */ `
  attribute float aEdge;
  attribute float aAlong;
  attribute float aKind;
  attribute float aWeight;
  uniform vec2 uLens;
  uniform float uLensRadius;
  uniform float uLensStrength;
  uniform float uOpacity[16];
  uniform float uHighlight[16];
  uniform float uCredit[16];
  uniform float uNegativeMix[16];
  varying float vAlong;
  varying float vKind;
  varying float vWeight;
  varying float vLens;
  varying float vOpacity;
  varying float vHighlight;
  varying float vCredit;
  varying float vNegative;

  void main() {
    vAlong = aAlong;
    vKind = aKind;
    vWeight = aWeight;

    int idx = int(aEdge + 0.5);
    vOpacity = uOpacity[idx];
    vHighlight = uHighlight[idx];
    vCredit = uCredit[idx];
    vNegative = uNegativeMix[idx];

    vec4 clip = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
    vec2 ndc = clip.xy / max(abs(clip.w), 0.0001);
    float d = length(ndc - uLens) / max(uLensRadius, 0.0001);
    float fall = 1.0 - smoothstep(0.0, 1.0, d);
    vLens = fall;

    vec2 dir = normalize(ndc - uLens + vec2(0.00011, 0.00019));
    clip.xy += dir * fall * uLensStrength * 0.055 * abs(clip.w);

    gl_Position = clip;
  }
`;

const EDGE_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uGray;
  uniform vec3 uObserved;
  uniform vec3 uAccent;
  uniform vec3 uNegative;
  uniform float uDashOn;
  varying float vAlong;
  varying float vKind;
  varying float vWeight;
  varying float vLens;
  varying float vOpacity;
  varying float vHighlight;
  varying float vCredit;
  varying float vNegative;

  void main() {
    if (vOpacity < 0.01) discard;

    // correlated relationships are the only dashed class
    if (vKind > 1.5 && uDashOn > 0.5) {
      if (fract(vAlong * 16.0) < 0.45) discard;
    }

    float weightMix = clamp(abs(vWeight) * 2.1, 0.3, 1.0);
    vec3 color = mix(uGray, uObserved, weightMix);
    color = mix(color, uAccent, clamp(vHighlight + vLens * 0.45, 0.0, 1.0));
    color = mix(color, uNegative, vNegative);

    // credit flows backward from reward: a bright head travelling 1 -> 0
    float head = 1.0 - vCredit;
    float band = smoothstep(0.12, 0.0, abs(vAlong - head)) * step(0.001, vCredit);
    color = mix(color, uAccent, band);

    float alpha = vOpacity * (0.3 + weightMix * 0.55 + vLens * 0.45 + band * 0.7);
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`;

const SIGNAL_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aBright;
  varying float vBright;
  void main() {
    vBright = aBright;
    vec4 view = viewMatrix * modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = clamp(aSize * (46.0 / max(-view.z, 0.6)), 1.0, 4.5);
  }
`;

const SIGNAL_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uObserved;
  uniform vec3 uAccent;
  varying float vBright;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    if (r > 0.5) discard;
    float a = 1.0 - smoothstep(0.24, 0.5, r);
    vec3 color = mix(uObserved, uAccent, vBright);
    gl_FragColor = vec4(color, a * (0.55 + vBright * 0.45));
  }
`;

const COLORS = {
  gray: '#3a3a37',
  observed: '#e8e8e3',
  accent: '#4fd8e8',
  negative: '#8c4a45',
};

const f = (n: number) => new Float32Array(n);

/**
 * Frame-rate independent approach factor. `tau` is the time constant in seconds.
 * Returns 1 on the first frame so the very first rendered image is already correct.
 */
const approach = (dt: number, tau: number, first: boolean): number =>
  first ? 1 : 1 - Math.exp(-dt / tau);
const MODIFIED: readonly ComponentId[] = ['PROMPT', 'MEMORY', 'RETRIEVER', 'PLANNER'];

interface Signal {
  edge: number;
  t: number;
  speed: number;
}

export interface CausalGraphProps {
  readonly layout: Layout;
}

export function CausalGraph({ layout }: CausalGraphProps) {
  const quality = useObservatory((s) => s.quality);
  const profile = qualityProfile(quality);
  const { camera, size } = useThree();

  const nodeMat = useRef<THREE.ShaderMaterial>(null);
  const edgeMat = useRef<THREE.ShaderMaterial>(null);
  const signalGeo = useRef<THREE.BufferGeometry>(null);
  const groupRef = useRef<THREE.Group>(null);

  const lensPos = useRef({ x: 0, y: 0, vx: 0, vy: 0, strength: 0 });
  const frames = useRef(0);
  const elapsed = useRef(0);

  const placed = useMemo<readonly PlacedNode[]>(
    () =>
      NODES.map((node, index) => ({
        id: node.id,
        archetype: node.archetype,
        index,
        position: { x: 0, y: 0, z: 0 },
        scale: node.id === 'REWARD' ? 1.5 : 1.3,
      })),
    [],
  );

  const merged = useMemo(
    () => mergeNodeGeometry(placed, profile.archetypeDetail),
    [placed, profile.archetypeDetail],
  );

  const nodeGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(merged.positions, 3));
    g.setAttribute('aNode', new THREE.BufferAttribute(merged.nodeIndex, 1));
    g.setAttribute('aRadius', new THREE.BufferAttribute(merged.localRadius, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 14);
    return g;
  }, [merged]);

  const edgeBuffers = useMemo(
    () => buildEdgeBuffers(EDGES, layout.byId, profile.edgeSegments),
    [layout.byId, profile.edgeSegments],
  );

  const edgeGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(edgeBuffers.positions, 3));
    g.setAttribute('aEdge', new THREE.BufferAttribute(edgeBuffers.edgeIndex, 1));
    g.setAttribute('aAlong', new THREE.BufferAttribute(edgeBuffers.along, 1));
    g.setAttribute('aKind', new THREE.BufferAttribute(edgeBuffers.kind, 1));
    g.setAttribute('aWeight', new THREE.BufferAttribute(edgeBuffers.weight, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 14);
    return g;
  }, [edgeBuffers]);

  const nodeUniforms = useMemo(
    () => ({
      uLens: { value: new THREE.Vector2() },
      uLensRadius: { value: 0.4 },
      uLensStrength: { value: 0 },
      uTime: { value: 0 },
      uAmbient: { value: 1 },
      uPeriod: { value: Float32Array.from(NODES.map((n) => n.idlePeriod)) },
      uOffset: { value: NODES.map(() => new THREE.Vector3()) },
      uBase: { value: new THREE.Color(COLORS.observed) },
      uAccent: { value: new THREE.Color(COLORS.accent) },
      uNegative: { value: new THREE.Color(COLORS.negative) },
      uOpacity: { value: f(8) },
      uHighlight: { value: f(8) },
      uNegativeMix: { value: f(8) },
    }),
    [],
  );

  const edgeUniforms = useMemo(
    () => ({
      uLens: { value: new THREE.Vector2() },
      uLensRadius: { value: 0.4 },
      uLensStrength: { value: 0 },
      uTime: { value: 0 },
      uGray: { value: new THREE.Color(COLORS.gray) },
      uObserved: { value: new THREE.Color(COLORS.observed) },
      uAccent: { value: new THREE.Color(COLORS.accent) },
      uNegative: { value: new THREE.Color(COLORS.negative) },
      uOpacity: { value: f(16) },
      uHighlight: { value: f(16) },
      uCredit: { value: f(16) },
      uNegativeMix: { value: f(16) },
      uDashOn: { value: 1 },
    }),
    [],
  );

  const signalUniforms = useMemo(
    () => ({
      uObserved: { value: new THREE.Color(COLORS.observed) },
      uAccent: { value: new THREE.Color(COLORS.accent) },
    }),
    [],
  );

  const signals = useMemo<Signal[]>(() => {
    const weights = EDGES.map((e) => Math.abs(e.weight));
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const out: Signal[] = [];
    const perEdge = Math.max(2, Math.floor(profile.signalBudget / EDGES.length));
    EDGES.forEach((edge, ei) => {
      const norm = max === min ? 0.5 : (Math.abs(edge.weight) - min) / (max - min);
      // 1 to 6 signals per second, linear in weight
      const rate = 1 + norm * 5;
      for (let i = 0; i < perEdge; i += 1) {
        out.push({ edge: ei, t: i / perEdge, speed: rate / 6 });
      }
    });
    return out;
  }, [profile.signalBudget]);

  const signalPositions = useMemo(() => f(signals.length * 3), [signals.length]);
  const signalSizes = useMemo(() => {
    const a = f(signals.length);
    a.fill(1.6);
    return a;
  }, [signals.length]);
  const signalBright = useMemo(() => f(signals.length), [signals.length]);

  useEffect(
    () => () => {
      nodeGeometry.dispose();
      edgeGeometry.dispose();
    },
    [nodeGeometry, edgeGeometry],
  );

  // Reusable scratch objects; nothing is allocated per frame.
  const scratch = useMemo(
    () => ({
      v: new THREE.Vector3(),
      nodeNdc: NODES.map(() => ({ x: 0, y: 0 })),
      edgeNdc: EDGES.map(() => ({ x: 0, y: 0 })),
    }),
    [],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    frames.current += 1;
    const first = frames.current <= 2;
    const store = useObservatory.getState();
    const d = store.derived;
    const reduced = store.reducedMotion;
    const nu = nodeUniforms;
    const eu = edgeUniforms;

    nu.uTime.value += reduced ? 0 : dt;
    eu.uTime.value = nu.uTime.value;
    nu.uAmbient.value = reduced ? 0 : 1;

    // ---- lens follow: damped, once per frame ----------------------------
    const targetX = pointer.ndc.x;
    const targetY = pointer.ndc.y;
    if (reduced) {
      lensPos.current.x = targetX;
      lensPos.current.y = targetY;
    } else {
      const [px, vx] = stepSpring(lensPos.current.x, lensPos.current.vx, targetX, dt);
      const [py, vy] = stepSpring(lensPos.current.y, lensPos.current.vy, targetY, dt);
      lensPos.current.x = px;
      lensPos.current.vx = vx;
      lensPos.current.y = py;
      lensPos.current.vy = vy;
    }

    const lensVisible = pointer.inside && store.openingComplete;
    const strengthTarget = lensVisible ? (reduced ? 0 : 1) : 0;
    lensPos.current.strength +=
      (strengthTarget - lensPos.current.strength) * approach(dt, 0.1, first);

    nu.uLens.value.set(lensPos.current.x, lensPos.current.y);
    eu.uLens.value.set(lensPos.current.x, lensPos.current.y);
    const radiusNdc = (LENS_RADIUS_PX / Math.max(size.width, size.height)) * 2.6;
    nu.uLensRadius.value = radiusNdc;
    eu.uLensRadius.value = radiusNdc;
    nu.uLensStrength.value = lensPos.current.strength;
    eu.uLensStrength.value = lensPos.current.strength * 1.1;

    // ---- node placement: mutation separates, decomposition fans out -----
    const mutation = d.mutation;
    const decomposition = d.decomposition;
    const counter = d.counterfactual;

    NODES.forEach((node, i) => {
      const base = layout.byId[node.id] ?? { x: 0, y: 0, z: 0 };
      const offset = nu.uOffset.value[i] as THREE.Vector3;

      const isModified = MODIFIED.includes(node.id);
      const quadrant = MODIFIED.indexOf(node.id);
      const fanX = quadrant < 0 ? 0 : quadrant % 2 === 0 ? -1.9 : 1.9;
      const fanY = quadrant < 0 ? 0 : quadrant < 2 ? 1.5 : -1.5;

      // mutation: the modified subsystems split away from the baseline position
      const splitX = isModified ? mutation * 0.42 * (quadrant % 2 === 0 ? -1 : 1) : 0;
      const splitY = isModified ? mutation * 0.3 * (quadrant < 2 ? 1 : -1) : 0;

      // attribution: they move into separated regions
      const decX = isModified ? decomposition * fanX : 0;
      const decY = isModified ? decomposition * fanY : 0;

      // counterfactual: the removed change recedes in depth
      const removed = store.interaction.counterfactualOf === node.id;
      const recede = removed ? counter * -2.6 : 0;

      offset.set(
        base.x + splitX + decX,
        base.y + splitY + decY,
        base.z + recede,
      );
    });

    // ---- node visibility and highlight ---------------------------------
    const selected = store.interaction.selected;
    const related = selected ? relatives(EDGES, selected) : null;
    const opacity = nu.uOpacity.value as Float32Array;
    const highlight = nu.uHighlight.value as Float32Array;
    const negative = nu.uNegativeMix.value as Float32Array;

    // During RECURSION the tree takes the frame, then the morph hands it back to the graph.
    const treeDominance = Math.min(1, Math.max(0, d.recursion));
    const morphed = Math.min(1, Math.max(0, d.recursion - 1));
    const graphFactor = 1 - 0.88 * treeDominance * (1 - morphed);

    // opening reveal: nodes arrive in depth order
    elapsed.current += dt;
    const reveal = store.openingComplete ? 1 : Math.min(1, elapsed.current / 1.4);

    NODES.forEach((node, i) => {
      const arrival = Math.min(1, Math.max(0, reveal * 8 - node.depth * 1.1));
      let target = arrival * graphFactor;
      if (related && !related.has(node.id)) target *= 0.2;
      if (store.interaction.counterfactualOf === node.id) target *= 0.35;

      const isModified = MODIFIED.includes(node.id);
      const contribution = ATTRIBUTION.contributions.find((c) => c.component === node.id);
      const creditLit =
        isModified && contribution !== undefined && contribution.value > 0 ? d.credit : 0;

      const hiTarget =
        (selected === node.id ? 0.9 : 0) +
        (store.interaction.intervention?.component === node.id ? 0.8 : 0) +
        creditLit * 0.7 +
        (isModified ? d.decomposition * 0.18 : 0);

      const negTarget =
        contribution !== undefined && contribution.value < 0
          ? Math.max(d.decomposition, d.credit)
          : 0;

      // Targets are already smooth functions of time and scroll, so opacity is assigned
      // directly; only the interaction-driven highlight carries its own easing.
      opacity[i] = target;
      negative[i] = negTarget;
      const k = approach(dt, reduced ? 0.06 : 0.12, first);
      highlight[i] = (highlight[i] ?? 0) + (Math.min(1, hiTarget) - (highlight[i] ?? 0)) * k;
    });

    // ---- edge visibility, credit and class ----------------------------
    const eop = eu.uOpacity.value as Float32Array;
    const ehi = eu.uHighlight.value as Float32Array;
    const ecr = eu.uCredit.value as Float32Array;
    const eneg = eu.uNegativeMix.value as Float32Array;

    const creditPaths = new Map<string, number>();
    if (d.credit > 0) {
      const ordered = [...ATTRIBUTION.contributions].sort(
        (a, b) => Math.abs(b.value) - Math.abs(a.value),
      );
      ordered.forEach((c, rank) => {
        const start = rank * 0.14;
        const local = Math.min(1, Math.max(0, (d.credit - start) / 0.5));
        if (local <= 0) return;
        for (const id of tracePath(EDGES, c.component, 'REWARD')) {
          creditPaths.set(id, Math.max(creditPaths.get(id) ?? 0, local));
        }
      });
    }

    const tracedSet = new Set(store.tracedPath);

    EDGES.forEach((edge, i) => {
      const endpointsVisible =
        (opacity[NODES.findIndex((n) => n.id === edge.from)] ?? 0) *
        (opacity[NODES.findIndex((n) => n.id === edge.to)] ?? 0);

      let target = endpointsVisible;
      if (related && !(related.has(edge.from) && related.has(edge.to))) target *= 0.2;

      const traced = tracedSet.has(edge.id) ? 0.85 : 0;
      const creditLevel = creditPaths.get(edge.id) ?? 0;
      const negTarget =
        edge.kind === 'correlated' ? Math.max(d.decomposition, d.credit) * 0.35 : 0;

      eop[i] = target;
      ecr[i] = creditLevel;
      eneg[i] = negTarget;
      const k = approach(dt, reduced ? 0.06 : 0.12, first);
      ehi[i] = (ehi[i] ?? 0) + (traced - (ehi[i] ?? 0)) * k;
    });

    // ---- signals -------------------------------------------------------
    const geo = signalGeo.current;
    if (geo) {
      const pos = signalPositions;
      const bright = signalBright;
      const running = !reduced;
      signals.forEach((sig, i) => {
        if (running) {
          sig.t += sig.speed * dt * 0.42;
          if (sig.t > 1) sig.t -= 1;
        }
        const edge = EDGES[sig.edge];
        if (!edge) return;
        const fromIdx = NODES.findIndex((n) => n.id === edge.from);
        const toIdx = NODES.findIndex((n) => n.id === edge.to);
        const from = nu.uOffset.value[fromIdx] as THREE.Vector3 | undefined;
        const to = nu.uOffset.value[toIdx] as THREE.Vector3 | undefined;
        if (!from || !to) return;
        const p = edgePoint(
          { x: from.x, y: from.y, z: from.z },
          { x: to.x, y: to.y, z: to.z },
          sig.t,
          bowOf(edge, sig.edge),
        );
        pos[i * 3] = p.x;
        pos[i * 3 + 1] = p.y;
        pos[i * 3 + 2] = p.z;
        const visible = eop[sig.edge] ?? 0;
        bright[i] = Math.max(ehi[sig.edge] ?? 0, ecr[sig.edge] ?? 0) * visible;
        signalSizes[i] = visible < 0.05 ? 0 : 1.0 + (bright[i] ?? 0) * 1.4;
      });
      const posAttr = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
      const brightAttr = geo.getAttribute('aBright') as THREE.BufferAttribute | undefined;
      const sizeAttr = geo.getAttribute('aSize') as THREE.BufferAttribute | undefined;
      if (posAttr) posAttr.needsUpdate = true;
      if (brightAttr) brightAttr.needsUpdate = true;
      if (sizeAttr) sizeAttr.needsUpdate = true;
    }

    // ---- publish projected node positions for DOM annotations -----------
    NODES.forEach((node, i) => {
      const off = nu.uOffset.value[i] as THREE.Vector3;
      scratch.v.copy(off).project(camera);
      const sx = (scratch.v.x * 0.5 + 0.5) * size.width;
      const sy = (-scratch.v.y * 0.5 + 0.5) * size.height;
      const onScreen =
        scratch.v.z < 1 &&
        sx > -80 &&
        sy > -80 &&
        sx < size.width + 80 &&
        sy < size.height + 80 &&
        (opacity[i] ?? 0) > 0.08;
      publishScreenPoint(node.id, sx, sy, onScreen);
    });

    // ---- lens hit test and mode --------------------------------------
    if (lensVisible) {
      let bestKind: LensMode = 'EXPLORE';
      let bestId: string | null = null as string | null;
      let bestDist = Number.POSITIVE_INFINITY;
      const radius2 = radiusNdc * radiusNdc * 0.55;

      NODES.forEach((node, i) => {
        const off = nu.uOffset.value[i] as THREE.Vector3;
        scratch.v.copy(off).project(camera);
        const entry = scratch.nodeNdc[i];
        if (entry) {
          entry.x = scratch.v.x;
          entry.y = scratch.v.y;
        }
        const dist = distance2(scratch.v.x, scratch.v.y, lensPos.current.x, lensPos.current.y);
        if (dist < radius2 && dist < bestDist && (opacity[i] ?? 0) > 0.25) {
          bestDist = dist;
          bestId = node.id;
          bestKind = node.mutable ? 'INTERVENE' : 'TRACE';
        }
      });

      if (bestId === null) {
        EDGES.forEach((edge, i) => {
          const fromIdx = NODES.findIndex((n) => n.id === edge.from);
          const toIdx = NODES.findIndex((n) => n.id === edge.to);
          const from = nu.uOffset.value[fromIdx] as THREE.Vector3 | undefined;
          const to = nu.uOffset.value[toIdx] as THREE.Vector3 | undefined;
          if (!from || !to) return;
          const mid = edgePoint(
            { x: from.x, y: from.y, z: from.z },
            { x: to.x, y: to.y, z: to.z },
            0.5,
            bowOf(edge, i),
          );
          scratch.v.set(mid.x, mid.y, mid.z).project(camera);
          const dist = distance2(scratch.v.x, scratch.v.y, lensPos.current.x, lensPos.current.y);
          if (dist < radius2 && dist < bestDist && (eop[i] ?? 0) > 0.2) {
            bestDist = dist;
            bestId = edge.id;
            bestKind = 'TRACE';
          }
        });
      }

      const holding = store.interaction.counterfactualOf !== null;
      const mode: LensMode = holding
        ? 'REWIND'
        : d.counterfactual > 0.2
          ? 'COMPARE'
          : bestKind;

      const lens = store.lens;
      const hitId: string | null = bestId;
      const kind = hitId === null ? 'none' : hitId.startsWith('EDGE_') ? 'edge' : 'node';
      if (lens.mode !== mode || lens.target.id !== hitId) {
        store.setLens({ mode, target: { kind, id: hitId } });
      }

      // traced path: from the hovered node to reward
      const traceFrom =
        kind === 'node' && hitId !== null
          ? (hitId as ComponentId)
          : store.interaction.selected;
      if (traceFrom) {
        const path = tracePath(EDGES, traceFrom, 'REWARD');
        if (path.join() !== store.tracedPath.join()) store.setTracedPath(path);
      } else if (store.tracedPath.length > 0) {
        store.setTracedPath([]);
      }
    }

    eu.uDashOn.value = 1;
    void state;
  });

  const scale = 1;

  return (
    <group ref={groupRef} scale={scale}>
      <lineSegments geometry={edgeGeometry} frustumCulled={false}>
        <shaderMaterial
          ref={edgeMat}
          attach="material"
          args={[
            {
              uniforms: edgeUniforms,
              vertexShader: EDGE_VERT,
              fragmentShader: EDGE_FRAG,
              transparent: true,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            },
          ]}
        />
      </lineSegments>

      <lineSegments geometry={nodeGeometry} frustumCulled={false}>
        <shaderMaterial
          ref={nodeMat}
          attach="material"
          args={[
            {
              uniforms: nodeUniforms,
              vertexShader: NODE_VERT,
              fragmentShader: NODE_FRAG,
              transparent: true,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            },
          ]}
        />
      </lineSegments>

      <points frustumCulled={false}>
        <bufferGeometry ref={signalGeo}>
          <bufferAttribute
            attach="attributes-position"
            args={[signalPositions, 3]}
          />
          <bufferAttribute attach="attributes-aSize" args={[signalSizes, 1]} />
          <bufferAttribute attach="attributes-aBright" args={[signalBright, 1]} />
        </bufferGeometry>
        <shaderMaterial
          attach="material"
          args={[
            {
              uniforms: signalUniforms,
              vertexShader: SIGNAL_VERT,
              fragmentShader: SIGNAL_FRAG,
              transparent: true,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            },
          ]}
        />
      </points>
    </group>
  );
}

export const PATH_CLASSES = PATH_CLASS;
export type { Vec3 };
