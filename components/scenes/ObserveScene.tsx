'use client';

import { NODES } from '@/lib/causalSimulation';
import { useObservatory } from '@/lib/store';
import { AnchoredLabel } from '@/components/typography/AnchoredLabel';
import { Group, IllustrativeTag, NumericReadout, Tech } from '@/components/typography';
import styles from './Scenes.module.css';

/** Scene 1. A live agent, a baseline, and nothing explained yet. */
export function ObserveScene({ opacity }: { readonly opacity: number }) {
  const model = useObservatory((s) => s.model);
  const targetId = useObservatory((s) => s.lens.target.id);
  const hovered = NODES.find((n) => n.id === targetId);
  const baseline = model.baseline;

  return (
    <>
      <Group className={styles.topLeft} style={{ opacity }}>
        <Tech tone="muted">{baseline.id}</Tech>
        <Tech tone="muted">TASK PERFORMANCE</Tech>
        <NumericReadout value={baseline.score} large />
        <IllustrativeTag />
      </Group>

      <Group className={styles.topRight} style={{ opacity }}>
        <Tech tone="muted">SYSTEM / 000</Tech>
        <Tech tone="muted">{`NODES ${NODES.length} / EDGES ${model.edges.length}`}</Tech>
        <Tech tone="muted">OBSERVED BEHAVIOUR ONLY</Tech>
      </Group>

      {hovered ? (
        <AnchoredLabel
          anchor={hovered.id}
          offsetX={-6}
          offsetY={-34}
          opacity={opacity}
          className={styles.annotation}
        >
          {hovered.id}
          <span style={{ color: 'var(--accent)' }}>
            {`  ${model.factual.versions[hovered.id]}`}
          </span>
          <span style={{ color: 'var(--muted)' }}>
            {`  OUT ${model.edges.filter((e) => e.from === hovered.id).length} / IN ${
              model.edges.filter((e) => e.to === hovered.id).length
            }`}
          </span>
        </AnchoredLabel>
      ) : null}
    </>
  );
}
