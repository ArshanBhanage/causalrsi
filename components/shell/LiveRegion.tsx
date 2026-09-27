'use client';

import { useEffect, useState } from 'react';
import {
  ATTRIBUTION,
  formatDelta,
  formatScore,
} from '@/lib/causalSimulation';
import { useObservatory } from '@/lib/store';

/**
 * The instrument's state in words. Phase changes are announced politely; the full causal state is
 * always available in the accessibility tree without a canvas.
 */
export function LiveRegion() {
  const phase = useObservatory((s) => s.derived.phase);
  const scene = useObservatory((s) => s.derived.scene);
  const model = useObservatory((s) => s.model);
  const intervention = useObservatory((s) => s.interaction.intervention);
  const counterfactualOf = useObservatory((s) => s.interaction.counterfactualOf);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setMessage(`${scene}. ${phase.replace(/_/g, ' ')}.`);
  }, [phase, scene]);

  const attribution = ATTRIBUTION.contributions
    .map((c) => `${c.component} ${formatDelta(c.value, 2)}`)
    .join(', ');

  return (
    <>
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {message}
      </div>
      <div className="visually-hidden">
        <h2>Current causal state</h2>
        <p>{`Active agent ${model.factual.id}, illustrative score ${formatScore(model.factual.score)}.`}</p>
        <p>{`Baseline ${model.baseline.id}, illustrative score ${formatScore(model.baseline.score)}.`}</p>
        <p>
          {intervention
            ? `Applied intervention: do(${intervention.component} = ${intervention.version}).`
            : 'No intervention applied.'}
        </p>
        <p>
          {counterfactualOf
            ? `Counterfactual active: ${counterfactualOf} change removed.`
            : 'Factual world.'}
        </p>
        <p>{`Illustrative attribution: ${attribution}. Interaction MEMORY by PLANNER ${formatDelta(
          ATTRIBUTION.interactions[0]?.value ?? 0,
          2,
        )}. Residual, unexplained, ${formatDelta(ATTRIBUTION.residual)}.`}</p>
        <p>All figures are illustrative simulation values, not experimental results.</p>
      </div>
    </>
  );
}
