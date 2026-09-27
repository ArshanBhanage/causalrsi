'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { qualityProfile, useObservatory } from '@/lib/store';

/**
 * Depth band Z-4. Not a star field: every trace is a faint residue of a past agent state, so its
 * density is tied to how far the timeline has advanced.
 */
const VERT = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uReveal;
  varying float vSeed;
  void main() {
    vSeed = aSeed;
    vec3 p = position;
    p.x += sin(uTime * 0.06 + aSeed * 6.283) * 0.22;
    p.y += cos(uTime * 0.045 + aSeed * 4.19) * 0.16;
    vec4 view = viewMatrix * modelMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = clamp((0.6 + aSeed * 1.0) * uReveal * (22.0 / max(-view.z, 0.8)), 0.6, 2.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uReveal;
  uniform vec3 uColor;
  varying float vSeed;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    if (r > 0.5) discard;
    float a = (0.16 + vSeed * 0.26) * uReveal * (1.0 - smoothstep(0.2, 0.5, r));
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

export function AmbientTraces() {
  const quality = useObservatory((s) => s.quality);
  const profile = qualityProfile(quality);
  const count = Math.round(520 * profile.archetypeDetail);

  const geometry = useMemo(() => {
    const position = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      // deterministic scatter; no RNG
      const a = Math.sin(i * 12.9898) * 43758.5453;
      const b = Math.sin(i * 78.233) * 12345.6789;
      const c = Math.sin(i * 39.425) * 24681.357;
      position[i * 3] = (a - Math.floor(a) - 0.5) * 26;
      position[i * 3 + 1] = (b - Math.floor(b) - 0.5) * 15;
      position[i * 3 + 2] = (c - Math.floor(c) - 0.5) * 12 - 7;
      seed[i] = Math.abs(a - Math.floor(a));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30);
    return geo;
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uColor: { value: new THREE.Color('#6e6e69') },
    }),
    [],
  );

  const matRef = useRef<THREE.ShaderMaterial>(null);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    const store = useObservatory.getState();
    if (!store.reducedMotion) uniforms.uTime.value += Math.min(delta, 1 / 20);
    const target = store.openingComplete ? 0.35 + store.derived.p * 0.65 : 0.12;
    uniforms.uReveal.value +=
      (target - uniforms.uReveal.value) * (1 - Math.exp(-Math.min(delta, 1 / 20) / 0.3));
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
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
    </points>
  );
}
