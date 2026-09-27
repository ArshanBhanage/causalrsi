'use client';

import { useState } from 'react';
import { ATTRIBUTION, CONFIDENCE, PATH_CLASS, formatDelta } from '@/lib/causalSimulation';
import { useObservatory } from '@/lib/store';
import { Group, IllustrativeTag, Notation, Tech } from '@/components/typography';
import styles from './Scenes.module.css';

const NOTATION: readonly { readonly text: string; readonly gloss: string }[] = [
  { text: 'P(Y | do(X))', gloss: 'The outcome distribution when X is set, not merely observed.' },
  { text: 'CONF / .91', gloss: 'Illustrative confidence that the effect sign is correct.' },
  { text: 'RESIDUAL', gloss: 'The part of the improvement no term accounts for.' },
];

function barWidth(value: number): number {
  return Math.max(6, Math.abs(value) * 620);
}

function barClass(kind: string, negative: boolean): string {
  if (negative) return styles.barNegative ?? '';
  if (kind === 'correlated') return styles.barDashed ?? '';
  if (kind === 'strong') return styles.barAccent ?? '';
  return styles.bar ?? '';
}

/** Scene 4. Four simultaneous changes, separated, with candidate paths of unequal honesty. */
export function AttributionScene({ opacity }: { readonly opacity: number }) {
  const decomposition = useObservatory((s) => s.derived.decomposition);
  const [gloss, setGloss] = useState<string | null>(null);

  const showResidual = Math.abs(ATTRIBUTION.residual) >= 0.005;

  return (
    <>
      <Group className={styles.topLeft} style={{ opacity }}>
        <Tech tone="muted">CAUSAL DECOMPOSITION</Tech>
        <Tech tone="muted">{`TOTAL ${formatDelta(ATTRIBUTION.totalDelta)}`}</Tech>
        <IllustrativeTag />
      </Group>

      <div className={styles.midLeft} style={{ opacity: opacity * decomposition }}>
        <div className={styles.table}>
          {ATTRIBUTION.contributions.map((c) => {
            const kind = PATH_CLASS[c.component] ?? 'weak';
            return (
              <div key={c.component} className={styles.tableRow}>
                <Tech tone={c.value < 0 ? 'negative' : 'default'}>{c.component}</Tech>
                <div className={styles.deltaRow}>
                  <span
                    className={barClass(kind, c.value < 0)}
                    style={{ width: `${barWidth(c.value)}px` }}
                  />
                  <Tech tone={c.value < 0 ? 'negative' : 'accent'}>{formatDelta(c.value, 2)}</Tech>
                  <Tech tone="muted" className={styles.conf}>
                    {`CONF / ${String(CONFIDENCE[c.component] ?? 0).replace('0', '')}`}
                  </Tech>
                </div>
              </div>
            );
          })}

          {ATTRIBUTION.interactions.map((i) => (
            <div key={i.pair.join('-')} className={styles.tableRow}>
              <Tech>{`${i.pair[0]} \u00d7 ${i.pair[1]}`}</Tech>
              <div className={styles.deltaRow}>
                <span className={styles.barAccent} style={{ width: `${barWidth(i.value)}px` }} />
                <Tech tone="accent">{formatDelta(i.value, 2)}</Tech>
                <Tech tone="muted" className={styles.conf}>INTERACTION</Tech>
              </div>
            </div>
          ))}

          {showResidual ? (
            <div className={styles.tableRow}>
              <Tech tone="muted">RESIDUAL / UNEXPLAINED</Tech>
              <div className={styles.deltaRow}>
                <span
                  className={styles.bar}
                  style={{ width: `${barWidth(ATTRIBUTION.residual)}px`, opacity: 0.4 }}
                />
                <Tech tone="muted">{formatDelta(ATTRIBUTION.residual)}</Tech>
              </div>
            </div>
          ) : null}
        </div>
        <IllustrativeTag />
      </div>

      <Group className={styles.bottomRight} style={{ opacity: opacity * decomposition }}>
        <div className={styles.legend}>
          <div className={styles.legendRow}>
            <span className={styles.barAccent} style={{ width: 26 }} />
            <Tech tone="muted">STRONG</Tech>
          </div>
          <div className={styles.legendRow}>
            <span className={styles.bar} style={{ width: 26, opacity: 0.55 }} />
            <Tech tone="muted">WEAK</Tech>
          </div>
          <div className={styles.legendRow}>
            <span className={styles.barDashed} style={{ width: 26 }} />
            <Tech tone="muted">CORRELATED, NOT CAUSAL</Tech>
          </div>
        </div>

        <div className={styles.interactive} style={{ marginTop: 10 }}>
          {NOTATION.map((n) => (
            <span
              key={n.text}
              onPointerEnter={() => setGloss(n.gloss)}
              onPointerLeave={() => setGloss(null)}
              style={{ display: 'block', cursor: 'help' }}
            >
              <Notation style={{ color: 'var(--muted)' }}>{n.text}</Notation>
            </span>
          ))}
        </div>

        <Tech tone="muted" className={styles.note}>
          {gloss ?? ''}
        </Tech>
      </Group>
    </>
  );
}
