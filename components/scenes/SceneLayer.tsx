'use client';

import type { ReactNode } from 'react';
import { useObservatory } from '@/lib/store';
import { ObserveScene } from './ObserveScene';
import { MutationScene } from './MutationScene';
import { EvaluationScene } from './EvaluationScene';
import { AttributionScene } from './AttributionScene';
import { InterventionScene } from './InterventionScene';
import { CounterfactualScene } from './CounterfactualScene';
import { CreditScene } from './CreditScene';
import { RecursionScene } from './RecursionScene';
import styles from './Scenes.module.css';

/**
 * Scenes cross-fade against one another as a function of scroll position. Nothing mounts or
 * unmounts on a phase boundary, so scrubbing backward restores the previous composition — but a
 * faded scene is made inert so its controls cannot be clicked, focused or read out.
 */
function weight(p: number, start: number, end: number, fade = 0.025): number {
  const inR = Math.min(1, Math.max(0, (p - start) / fade));
  const outR = 1 - Math.min(1, Math.max(0, (p - (end - fade)) / fade));
  return Math.min(inR, outR);
}

interface SceneFrameProps {
  readonly opacity: number;
  readonly label: string;
  readonly children: ReactNode;
}

function SceneFrame({ opacity, label, children }: SceneFrameProps) {
  const active = opacity > 0.55;
  const present = opacity > 0.02;

  return (
    <div
      className={styles.frame}
      data-scene={label}
      aria-hidden={!active}
      style={{
        opacity,
        visibility: present ? 'visible' : 'hidden',
        pointerEvents: active ? 'auto' : 'none',
      }}
    >
      {children}
    </div>
  );
}

export function SceneLayer() {
  const p = useObservatory((s) => s.derived.p);
  const openingComplete = useObservatory((s) => s.openingComplete);
  const base = openingComplete ? 1 : 0;

  const scenes: readonly { readonly label: string; readonly o: number; readonly node: ReactNode }[] =
    [
      // the landing scene must be composed at p = 0, so it has no fade-in
      { label: 'OBSERVE', o: base * weight(p, -0.03, 0.16), node: <ObserveScene opacity={1} /> },
      { label: 'MUTATION', o: base * weight(p, 0.15, 0.31), node: <MutationScene opacity={1} /> },
      { label: 'EVALUATION', o: base * weight(p, 0.3, 0.46), node: <EvaluationScene opacity={1} /> },
      {
        label: 'ATTRIBUTION',
        o: base * weight(p, 0.45, 0.53),
        node: <AttributionScene opacity={1} />,
      },
      {
        label: 'INTERVENTION',
        o: base * weight(p, 0.525, 0.61),
        node: <InterventionScene opacity={1} />,
      },
      {
        label: 'COUNTERFACTUAL',
        o: base * weight(p, 0.6, 0.76),
        node: <CounterfactualScene opacity={1} />,
      },
      { label: 'CREDIT', o: base * weight(p, 0.75, 0.91), node: <CreditScene opacity={1} /> },
      {
        label: 'RECURSION',
        o: base * weight(p, 0.9, 1.001),
        node: <RecursionScene opacity={1} />,
      },
    ];

  return (
    <div className={styles.stage}>
      {scenes.map((scene) => (
        <SceneFrame key={scene.label} label={scene.label} opacity={scene.o}>
          {scene.node}
        </SceneFrame>
      ))}
    </div>
  );
}
