'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LINEAGE, NODES } from '@/lib/causalSimulation';
import { layoutTree, type Layout } from '@/lib/graphLayout';
import { lerpValue } from '@/lib/motion';
import { useObservatory } from '@/lib/store';

/**
 * The signature transformation. The same seven instances hold the evolution tree and then
 * rearrange into the causal graph; nothing is created or destroyed across the morph.
 */
const VERT = /* glsl */ `
  attribute vec3 aTarget;
  attribute float aBright;
  uniform float uMorph;
  uniform float uReveal;
  varying float vBright;
  void main() {
    vBright = aBright;
    vec3 p = mix(position, aTarget, uMorph);
    vec4 view = viewMatrix * modelMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = clamp((9.0 + aBright * 13.0) * (60.0 / max(-view.z, 0.8)), 4.0, 30.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uReveal;
  uniform vec3 uBase;
  uniform vec3 uAccent;
  varying float vBright;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    if (r > 0.5) discard;
    float ring = smoothstep(0.5, 0.42, r) - smoothstep(0.34, 0.26, r);
    float core = smoothstep(0.2, 0.0, r);
    float a = (ring * 1.0 + core * 0.85) * uReveal;
    if (a < 0.01) discard;
    gl_FragColor = vec4(mix(uBase, uAccent, vBright), a);
  }
`;

const EDGE_VERT = /* glsl */ `
  attribute vec3 aTarget;
  uniform float uMorph;
  void main() {
    vec3 p = mix(position, aTarget, uMorph);
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
  }
`;

const EDGE_FRAG = /* glsl */ `
  precision highp float;
  uniform float uReveal;
  uniform vec3 uBase;
  void main() {
    float a = uReveal * 0.55;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uBase, a);
  }
`;

export interface EvolutionTreeProps {
  readonly layout: Layout;
}

export function EvolutionTree({ layout }: EvolutionTreeProps) {
  const pointUniforms = useMemo(
    () => ({
      uMorph: { value: 0 },
      uReveal: { value: 0 },
      uBase: { value: new THREE.Color('#e8e8e3') },
      uAccent: { value: new THREE.Color('#4fd8e8') },
    }),
    [],
  );

  const edgeUniforms = useMemo(
    () => ({
      uMorph: { value: 0 },
      uReveal: { value: 0 },
      uBase: { value: new THREE.Color('#6e6e69') },
    }),
    [],
  );

  const tree = useMemo(() => layoutTree(LINEAGE), []);

  /** Each lineage record maps onto a graph node so the morph has a destination. */
  const targets = useMemo(() => {
    const order = NODES.map((n) => n.id);
    return LINEAGE.map((record, i) => {
      const nodeId = order[i % order.length];
      const pos = nodeId ? layout.byId[nodeId] : undefined;
      return pos ?? { x: 0, y: 0, z: 0 };
    });
  }, [layout.byId]);

  const pointGeometry = useMemo(() => {
    const count = LINEAGE.length;
    const position = new Float32Array(count * 3);
    const target = new Float32Array(count * 3);
    const bright = new Float32Array(count);
    const maxScore = Math.max(...LINEAGE.map((a) => a.score));
    LINEAGE.forEach((record, i) => {
      const t = tree[record.id] ?? { x: 0, y: 0, z: 0 };
      position[i * 3] = t.x;
      position[i * 3 + 1] = t.y;
      position[i * 3 + 2] = t.z;
      const g = targets[i] ?? { x: 0, y: 0, z: 0 };
      target[i * 3] = g.x;
      target[i * 3 + 1] = g.y;
      target[i * 3 + 2] = g.z;
      bright[i] = record.score / maxScore > 0.95 ? 1 : 0.15;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geo.setAttribute('aTarget', new THREE.BufferAttribute(target, 3));
    geo.setAttribute('aBright', new THREE.BufferAttribute(bright, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 18);
    return geo;
  }, [targets, tree]);

  const edgeGeometry = useMemo(() => {
    const pairs = LINEAGE.filter((r) => r.parent !== null).map((r) => [r.parent as string, r.id]);
    const position = new Float32Array(pairs.length * 6);
    const target = new Float32Array(pairs.length * 6);
    const indexOf = (id: string) => LINEAGE.findIndex((r) => r.id === id);

    pairs.forEach(([a, b], i) => {
      const ta = tree[a ?? ''] ?? { x: 0, y: 0, z: 0 };
      const tb = tree[b ?? ''] ?? { x: 0, y: 0, z: 0 };
      position.set([ta.x, ta.y, ta.z, tb.x, tb.y, tb.z], i * 6);
      const ga = targets[indexOf(a ?? '')] ?? { x: 0, y: 0, z: 0 };
      const gb = targets[indexOf(b ?? '')] ?? { x: 0, y: 0, z: 0 };
      target.set([ga.x, ga.y, ga.z, gb.x, gb.y, gb.z], i * 6);
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geo.setAttribute('aTarget', new THREE.BufferAttribute(target, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 18);
    return geo;
  }, [targets, tree]);

  const pointMat = useRef<THREE.ShaderMaterial>(null);

  useEffect(
    () => () => {
      pointGeometry.dispose();
      edgeGeometry.dispose();
    },
    [pointGeometry, edgeGeometry],
  );

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const store = useObservatory.getState();
    const r = store.derived.recursion; // 0 -> 2
    const morph = Math.min(1, Math.max(0, r - 1));
    // the tree holds the frame through the morph, then yields to the causal graph it became
    const reveal =
      Math.min(1, Math.max(0, r)) * (1 - 0.75 * Math.min(1, Math.max(0, (morph - 0.7) / 0.3)));
    const k = 1 - Math.exp(-dt / (store.reducedMotion ? 0.06 : 0.22));

    pointUniforms.uReveal.value = lerpValue(pointUniforms.uReveal.value, reveal, k);
    pointUniforms.uMorph.value = lerpValue(pointUniforms.uMorph.value, morph, k);
    edgeUniforms.uReveal.value = pointUniforms.uReveal.value;
    edgeUniforms.uMorph.value = pointUniforms.uMorph.value;
  });

  return (
    <group>
      <lineSegments geometry={edgeGeometry} frustumCulled={false}>
        <shaderMaterial
          attach="material"
          args={[
            {
              uniforms: edgeUniforms,
              vertexShader: EDGE_VERT,
              fragmentShader: EDGE_FRAG,
              transparent: true,
              depthWrite: false,
            },
          ]}
        />
      </lineSegments>
      <points geometry={pointGeometry} frustumCulled={false}>
        <shaderMaterial
          ref={pointMat}
          attach="material"
          args={[
            {
              uniforms: pointUniforms,
              vertexShader: VERT,
              fragmentShader: FRAG,
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
