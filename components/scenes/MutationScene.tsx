'use client';

import { changedComponents } from '@/lib/causalSimulation';
import { useObservatory } from '@/lib/store';
import { AnchoredLabel } from '@/components/typography/AnchoredLabel';
import { Group, IllustrativeTag, Tech } from '@/components/typography';
import styles from './Scenes.module.css';

/**
 * Scene 2. The agent rewrites itself. Four things change at once, and each delta is pinned to the
 * geometry that changed rather than parked in a corner.
 */
export function MutationScene({ opacity }: { readonly opacity: number }) {
  const model = useObservatory((s) => s.model);
  const mutation = useObservatory((s) => s.derived.mutation);
  const changed = changedComponents(model.baseline, model.factual);

  return (
    <>
      {changed.map((id, i) => {
        const reveal = Math.min(1, Math.max(0, mutation * 4 - i * 0.7));
        return (
          <AnchoredLabel
            key={id}
            anchor={id}
            offsetX={-6}
            offsetY={-38}
            opacity={opacity * reveal}
            className={styles.annotation}
          >
            {`\u0394 ${id}`}
            <span style={{ color: 'var(--muted)' }}>
              {`  ${model.baseline.versions[id]} \u2192 ${model.factual.versions[id]}`}
            </span>
          </AnchoredLabel>
        );
      })}

      <Group className={styles.topLeft} style={{ opacity }}>
        <Tech tone="muted">SELF-MODIFICATION</Tech>
        <Tech>{`${changed.length} SUBSYSTEMS CHANGED`}</Tech>
        <IllustrativeTag />
      </Group>

      <Group className={styles.bottomRight} style={{ opacity: opacity * mutation }}>
        <Tech tone="accent">{model.factual.id}</Tech>
        <Tech tone="muted">CANDIDATE GENERATION</Tech>
      </Group>
    </>
  );
}
