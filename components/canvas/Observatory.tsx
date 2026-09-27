'use client';

import { useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EDGES, NODES } from '@/lib/causalSimulation';
import { DEFAULT_SEED, layoutGraph } from '@/lib/graphLayout';
import { FrameSampler, QUALITY, initialMode, readDeviceHints } from '@/lib/performance';
import { useObservatory } from '@/lib/store';
import { CausalGraph } from '@/components/causal/CausalGraph';
import { CounterfactualWorld } from '@/components/causal/CounterfactualWorld';
import { EvolutionTree } from '@/components/causal/EvolutionTree';
import { AmbientTraces } from './AmbientTraces';
import { CameraRig } from './CameraRig';

/** Samples frame time and steps the quality tier down only, so it cannot oscillate. */
function QualityGovernor() {
  const sampler = useMemo(() => new FrameSampler(120), []);
  const degrade = useObservatory((s) => s.degrade);

  useFrame((_, delta) => {
    sampler.push(delta * 1000);
    if (sampler.shouldDegrade()) {
      const mode = useObservatory.getState().quality;
      if (mode !== 'MINIMAL') {
        degrade();
        if (process.env.NODE_ENV !== 'production') {
          console.info(
            `[observatory] frame budget exceeded (median ${sampler.median().toFixed(1)}ms), stepping quality down from ${mode}`,
          );
        }
      }
      sampler.reset();
    }
  });

  return null;
}

/** Suspends the render loop while the tab is hidden. */
function VisibilityGuard() {
  const { invalidate, setFrameloop } = useThree();

  useEffect(() => {
    const onChange = () => {
      if (document.hidden) setFrameloop('never');
      else {
        setFrameloop('always');
        invalidate();
      }
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [invalidate, setFrameloop]);

  return null;
}

function World() {
  const { size } = useThree();
  const aspect = size.height === 0 ? 16 / 9 : size.width / size.height;

  const layout = useMemo(
    () => layoutGraph(NODES, EDGES, { seed: DEFAULT_SEED, aspect }),
    [aspect],
  );

  return (
    <>
      <CameraRig />
      <QualityGovernor />
      <VisibilityGuard />
      {/* Z-4 */}
      <AmbientTraces />
      {/* Z-3 */}
      <CounterfactualWorld layout={layout} />
      {/* Z-2 */}
      <EvolutionTree layout={layout} />
      {/* Z-1 */}
      <CausalGraph layout={layout} />
    </>
  );
}

export default function Observatory() {
  const quality = useObservatory((s) => s.quality);
  const setQuality = useObservatory((s) => s.setQuality);

  useEffect(() => {
    setQuality(initialMode(readDeviceHints()));
  }, [setQuality]);

  const cap = QUALITY[quality].dprCap;

  return (
    <Canvas
      dpr={[1, cap]}
      gl={{
        antialias: false,
        alpha: true,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true,
      }}
      camera={{ position: [0.6, 0.1, 2.2], fov: 28, near: 0.05, far: 120 }}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%' }}
      aria-hidden="true"
    >
      <World />
    </Canvas>
  );
}
