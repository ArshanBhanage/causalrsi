'use client';

import { formatPercent } from '@/lib/causalSimulation';
import { useObservatory } from '@/lib/store';
import { Group, Hero, IllustrativeTag, NumericReadout, Tech } from '@/components/typography';
import styles from './Scenes.module.css';

/**
 * Scene 3. The improvement is made satisfying and then interrupted. The freeze is driven by
 * scroll position rather than by a timer, so scrubbing backward truly reverses it.
 */
export function EvaluationScene({ opacity }: { readonly opacity: number }) {
  const model = useObservatory((s) => s.model);
  const derived = useObservatory((s) => s.derived);
  const p = derived.p;

  const scores = Math.min(1, Math.max(0, (p - 0.3) / 0.045));
  const better = Math.min(1, Math.max(0, (p - 0.355) / 0.025));
  const butWhy = Math.min(1, Math.max(0, (p - 0.4) / 0.025));
  const betterVisible = better * (1 - butWhy);

  const delta = model.factual.score - model.baseline.score;

  return (
    <>
      <Group className={styles.topLeft} style={{ opacity: opacity * scores * (1 - butWhy * 0.7) }}>
        <Tech tone="muted">{model.baseline.id}</Tech>
        <NumericReadout value={model.baseline.score} />
        <Tech tone="muted">{model.factual.id}</Tech>
        <NumericReadout value={derived.displayScore} large />
        <Tech tone="accent">
          <NumericReadout value={delta} signed />
        </Tech>
        <IllustrativeTag />
      </Group>

      <div className={styles.headlineLeft} style={{ opacity: opacity * betterVisible }}>
        <Hero>BETTER.</Hero>
      </div>

      <div className={styles.headlineRight} style={{ opacity: opacity * butWhy }}>
        <Hero>
          BUT
          <br />
          WHY?
        </Hero>
      </div>

      <Group className={styles.bottomRight} style={{ opacity: opacity * scores }}>
        <Tech tone="muted">{formatPercent(model.baseline.score, model.factual.score)}</Tech>
        <Tech tone="muted">AGGREGATE EVALUATION</Tech>
        <IllustrativeTag />
      </Group>
    </>
  );
}
