'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EDGES, relatives } from '@/lib/causalSimulation';
import { buildEdgeBuffers } from '@/lib/edges';
import type { Layout } from '@/lib/graphLayout';
import { qualityProfile, useObservatory } from '@/lib/store';

/**
 * The alternate history. It lives permanently in the Z-3 depth band at zero opacity, so a hold
 * never allocates: it only raises `uBlend`.
 */
const VERT = /* glsl */ `
  attribute float aEdge;
  attribute float aAlong;
  uniform float uBlend;
  uniform float uRemoved[16];
  varying float vAlong;
  varying float vRemoved;
  void main() {
    vAlong = aAlong;
    int idx = int(aEdge + 0.5);
    vRemoved = uRemoved[idx];
    vec3 p = position;
    // folds forward out of depth as the blend rises
    p.z -= (1.0 - uBlend) * 2.2;
    p.xy *= 0.94 + uBlend * 0.06;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uBlend;
  uniform vec3 uGhost;
  varying float vAlong;
  varying float vRemoved;
  void main() {
    // the removed modification is absent from this world
    if (vRemoved > 0.5) discard;
    // counterfactual relationships are dashed by definition
    if (fract(vAlong * 22.0) > 0.5) discard;
    float alpha = uBlend * 0.42;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uGhost, alpha);
  }
`;

export interface CounterfactualWorldProps {
  readonly layout: Layout;
}

export function CounterfactualWorld({ layout }: CounterfactualWorldProps) {
  const quality = useObservatory((s) => s.quality);
  const profile = qualityProfile(quality);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const buffers = useMemo(
    () => buildEdgeBuffers(EDGES, layout.byId, Math.max(8, Math.floor(profile.edgeSegments / 2))),
    [layout.byId, profile.edgeSegments],
  );

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3));
    g.setAttribute('aEdge', new THREE.BufferAttribute(buffers.edgeIndex, 1));
    g.setAttribute('aAlong', new THREE.BufferAttribute(buffers.along, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 16);
    return g;
  }, [buffers]);

  const uniforms = useMemo(
    () => ({
      uBlend: { value: 0 },
      uRemoved: { value: new Float32Array(16) },
      uGhost: { value: new THREE.Color('#9aa3a6') },
    }),
    [],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const store = useObservatory.getState();
    const target = store.derived.counterfactual;
    // 400-700ms fold, frame-rate independent
    const k = 1 - Math.exp(-dt / (store.reducedMotion ? 0.06 : 0.16));
    uniforms.uBlend.value += (target - uniforms.uBlend.value) * k;

    const removed = uniforms.uRemoved.value as Float32Array;
    const cf = store.interaction.counterfactualOf;
    const affected = cf ? relatives(EDGES, cf) : null;
    EDGES.forEach((edge, i) => {
      const gone = cf !== null && (edge.from === cf || edge.to === cf);
      const downstream = affected !== null && gone;
      removed[i] = downstream ? 1 : 0;
    });
  });

  return (
    <lineSegments geometry={geometry} frustumCulled={false} position={[0, 0, -1.4]}>
      <shaderMaterial
        ref={matRef}
        attach="material"
        args={[
          {
            uniforms,
            vertexShader: VERT,
            fragmentShader: FRAG,
            transparent: true,
            depthWrite: false,
          },
        ]}
      />
    </lineSegments>
  );
}
