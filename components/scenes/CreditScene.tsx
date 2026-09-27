'use client';

import { ATTRIBUTION, EDGES, computeCreditFlow, formatDelta } from '@/lib/causalSimulation';
import { useObservatory } from '@/lib/store';
import { Group, Hero, IllustrativeTag, Tech } from '@/components/typography';
import styles from './Scenes.module.css';

const FLOW = computeCreditFlow(ATTRIBUTION, EDGES);

/** Scene 7. Credit runs backward from reward to the changes that earned it. */
export function CreditScene({ opacity }: { readonly opacity: number }) {
  const credit = useObservatory((s) => s.derived.credit);

  // three display lines, one at a time, driven by scroll so reverse scroll reverses them
  const one = Math.min(1, Math.max(0, (credit - 0.05) / 0.12));
  const two = Math.min(1, Math.max(0, (credit - 0.38) / 0.12));
  const three = Math.min(1, Math.max(0, (credit - 0.7) / 0.12));

  const lineOne = one * (1 - two);
  const lineTwo = two * (1 - three);
  const lineThree = three;

  const max = Math.max(...FLOW.entries.map((e) => Math.abs(e.credit)), 0.0001);

  return (
    <>
      <div className={styles.headlineLeft} style={{ opacity: opacity * lineOne }}>
        <Hero>WHAT CHANGED?</Hero>
      </div>

      <div className={styles.headlineRight} style={{ opacity: opacity * lineTwo }}>
        <Hero>
          WHAT CAUSED
          <br />
          THE CHANGE?
        </Hero>
      </div>

      <div className={styles.headlineCenterLow} style={{ opacity: opacity * lineThree }}>
        <Hero>
          CAUSAL
          <br />
          CREDIT
          <br />
          ASSIGNMENT
        </Hero>
      </div>

      <Group className={styles.topLeft} style={{ opacity: opacity * Math.min(1, credit * 3) }}>
        <Tech tone="muted">CREDIT FROM REWARD</Tech>
        {FLOW.entries.map((entry, i) => {
          const reveal = Math.min(1, Math.max(0, credit * 4 - i * 0.5));
          const negative = entry.credit < 0;
          return (
            <div key={entry.component} className={styles.deltaRow} style={{ opacity: reveal }}>
              <Tech tone={negative ? 'negative' : 'default'}>{entry.component}</Tech>
              <span
                className={negative ? styles.barNegative : styles.barAccent}
                style={{ width: `${Math.max(6, (Math.abs(entry.credit) / max) * 140)}px` }}
              />
              <Tech tone={negative ? 'negative' : 'accent'}>{formatDelta(entry.credit)}</Tech>
            </div>
          );
        })}
        <Tech tone="muted">{`RESIDUAL / UNEXPLAINED ${formatDelta(FLOW.residual)}`}</Tech>
        <IllustrativeTag />
      </Group>
    </>
  );
}
