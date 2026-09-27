'use client';

import { MUTABLE_IDS, deriveCounterfactual, formatDelta } from '@/lib/causalSimulation';
import { useCoarsePointer } from '@/hooks/useCoarsePointer';
import { useObservatory } from '@/lib/store';
import { Group, IllustrativeTag, NumericReadout, Tech } from '@/components/typography';
import styles from './Scenes.module.css';

/** Scene 6. Remove a change. Watch the outcome move. */
export function CounterfactualScene({ opacity }: { readonly opacity: number }) {
  const model = useObservatory((s) => s.model);
  const held = useObservatory((s) => s.interaction.counterfactualOf);
  const selected = useObservatory((s) => s.interaction.selected);
  const setCounterfactual = useObservatory((s) => s.setCounterfactual);
  const coarse = useCoarsePointer();

  const subject = held ?? selected ?? MUTABLE_IDS[1] ?? 'MEMORY';
  const world = deriveCounterfactual(model, subject);

  return (
    <>
      <Group className={styles.topLeft} style={{ opacity }}>
        <Tech tone="muted">{coarse ? 'PRESS AND HOLD TO REMOVE THIS CHANGE' : 'HOLD TO REMOVE THIS CHANGE'}</Tech>
        <div className={styles.picker}>
          {MUTABLE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={subject === id ? styles.pickerItemActive : styles.pickerItem}
              onPointerDown={() => setCounterfactual(id)}
              onPointerUp={() => setCounterfactual(null)}
              onPointerLeave={() => setCounterfactual(null)}
              onFocus={() => undefined}
              aria-pressed={held === id}
            >
              <span className={styles.rule} />
              <span>{`REMOVE \u0394 ${id}`}</span>
            </button>
          ))}
        </div>
        <Tech tone="muted">HOLD C FOR THE SAME COMPARISON</Tech>
      </Group>

      {world.ok ? (
        <Group className={styles.midRight} style={{ opacity }}>
          <Tech tone="muted">FACTUAL</Tech>
          <Tech>{world.value.factualId}</Tech>
          <NumericReadout value={world.value.factualScore} large />

          <Tech tone="muted" style={{ marginTop: 10 }}>
            COUNTERFACTUAL
          </Tech>
          <Tech tone="accent">{world.value.counterfactualId}</Tech>
          <NumericReadout value={world.value.counterfactualScore} large />

          <Tech tone="muted" style={{ marginTop: 10 }}>
            ATTRIBUTABLE EFFECT
          </Tech>
          <Tech tone="accent">{formatDelta(world.value.attributedEffect)}</Tech>
          <IllustrativeTag />
        </Group>
      ) : (
        <Group className={styles.midRight} style={{ opacity }}>
          <Tech tone="muted">NO COUNTERFACTUAL AVAILABLE FOR THIS COMPONENT</Tech>
        </Group>
      )}
    </>
  );
}
