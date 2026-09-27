'use client';

import { LINEAGE, formatScore } from '@/lib/causalSimulation';
import { CLOSING_LINES, RESEARCH_FOCUS_LINE, SITE } from '@/content/site';
import { useObservatory } from '@/lib/store';
import { Group, Hero, IllustrativeTag, Sub, Tech } from '@/components/typography';
import styles from './Scenes.module.css';

/** Scene 8. Credited knowledge becomes the next generation, then the tree becomes the model. */
export function RecursionScene({ opacity }: { readonly opacity: number }) {
  const recursion = useObservatory((s) => s.derived.recursion);
  const p = useObservatory((s) => s.derived.p);

  const chain = Math.min(1, Math.max(0, recursion * 3));
  const tree = Math.min(1, Math.max(0, recursion - 0.2));
  const morph = Math.min(1, Math.max(0, recursion - 1));
  const closing = Math.min(1, Math.max(0, (p - 0.962) / 0.02));

  return (
    <>
      <Group className={styles.topLeft} style={{ opacity: opacity * chain * (1 - morph) }}>
        <Tech tone="muted">RECURSIVE IMPROVEMENT</Tech>
        <Tech>AGENT_0042 &rarr; 0043 &rarr; 0044 &rarr; 0045</Tech>
        <IllustrativeTag />
      </Group>

      <Group className={styles.bottomLeft} style={{ opacity: opacity * tree * (1 - closing) }}>
        {LINEAGE.map((record) => (
          <div key={record.id} className={styles.deltaRow}>
            <Tech tone="muted">{record.id.replace('AGENT_', '')}</Tech>
            <Tech tone={record.score > 0.86 ? 'accent' : 'default'}>{formatScore(record.score)}</Tech>
          </div>
        ))}
        <IllustrativeTag />
      </Group>

      <Group className={styles.topRight} style={{ opacity: opacity * morph * (1 - closing) }}>
        <Tech tone="muted">EVOLUTION TREE</Tech>
        <Tech tone="accent">&rarr; CAUSAL GRAPH</Tech>
        <Tech tone="muted">SAME GEOMETRY, REARRANGED</Tech>
      </Group>

      <div className={styles.headlineLeft} style={{ opacity: opacity * closing, top: '16%' }}>
        <Hero>
          {CLOSING_LINES.map((line) => (
            <span key={line} style={{ display: 'block' }}>
              {line}
            </span>
          ))}
        </Hero>
      </div>

      <Group className={styles.bottomRight} style={{ opacity: opacity * closing }}>
        <Sub>{SITE.project}</Sub>
        <Tech tone="muted" className={styles.note}>
          {RESEARCH_FOCUS_LINE}
        </Tech>
      </Group>
    </>
  );
}
