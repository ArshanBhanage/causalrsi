'use client';

import { useEffect } from 'react';
import { MUTABLE_IDS, NODES, availableVersion, tracePath } from '@/lib/causalSimulation';
import { useObservatory } from '@/lib/store';
import { Group, IllustrativeTag, Notation, NumericReadout, Tech } from '@/components/typography';
import styles from './Scenes.module.css';

/**
 * Scene 5. The visitor performs the method. Propagation is sequenced hop by hop rather than
 * glowing everywhere at once.
 */
export function InterventionScene({ opacity }: { readonly opacity: number }) {
  const model = useObservatory((s) => s.model);
  const selected = useObservatory((s) => s.interaction.selected);
  const intervention = useObservatory((s) => s.interaction.intervention);
  const propagation = useObservatory((s) => s.propagation);
  const select = useObservatory((s) => s.select);
  const intervene = useObservatory((s) => s.intervene);
  const resetIntervention = useObservatory((s) => s.resetIntervention);
  const setPropagation = useObservatory((s) => s.setPropagation);

  const path = intervention ? tracePath(model.edges, intervention.component, 'REWARD') : [];

  useEffect(() => {
    if (propagation.stage !== 'running' || path.length === 0) return;
    let hop = 0;
    let cancelled = false;
    const advance = () => {
      if (cancelled) return;
      hop += 1;
      setPropagation({ hop, total: path.length });
      if (hop >= path.length) {
        setPropagation({ stage: 'settled', hop, total: path.length });
        return;
      }
      window.setTimeout(advance, 260);
    };
    const timer = window.setTimeout(advance, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [propagation.stage, path.length, setPropagation]);

  const chain: string[] = [];
  for (const edgeId of path) {
    const edge = model.edges.find((e) => e.id === edgeId);
    if (!edge) continue;
    if (chain.length === 0) chain.push(edge.from);
    chain.push(edge.to);
  }
  const revealed = chain.slice(0, Math.max(1, propagation.hop + 1));

  const outcome =
    propagation.stage === 'settled' ? model.factual.score : model.baseline.score;

  return (
    <>
      <Group className={styles.topLeft} style={{ opacity }}>
        <Tech tone="muted">{selected ? 'INTERVENE?' : 'SELECT A COMPONENT'}</Tech>
        <div className={styles.picker}>
          {MUTABLE_IDS.map((id, i) => {
            const node = NODES.find((n) => n.id === id);
            const active = selected === id;
            return (
              <button
                key={id}
                type="button"
                className={active ? styles.pickerItemActive : styles.pickerItem}
                onClick={() => select(active ? null : id)}
                aria-pressed={active}
              >
                <span>{String(i + 1).padStart(2, '0')}</span>
                <span className={styles.rule} />
                <span>{id}</span>
                <span style={{ color: 'var(--muted-dim)' }}>
                  {node ? model.factual.versions[node.id] : ''}
                </span>
              </button>
            );
          })}
        </div>
      </Group>

      <Group className={styles.midRight} style={{ opacity: opacity * (selected ? 1 : 0) }}>
        {selected ? (
          <>
            <Notation style={{ color: 'var(--muted)' }}>
              {`do(${selected} = ${availableVersion(model, selected) ?? '\u2014'})`}
            </Notation>
            <button
              type="button"
              className={styles.control}
              onClick={() => intervene(selected)}
              disabled={availableVersion(model, selected) === null}
            >
              APPLY INTERVENTION
            </button>
            <button type="button" className={styles.controlMuted} onClick={resetIntervention}>
              RESET
            </button>
          </>
        ) : null}
      </Group>

      <Group
        className={styles.bottomLeft}
        style={{ opacity: opacity * (intervention ? 1 : 0) }}
      >
        {intervention ? (
          <>
            <Notation style={{ color: 'var(--accent)' }}>
              {`do(${intervention.component} = ${intervention.version})`}
            </Notation>
            <Tech tone="muted">{revealed.join(' \u2192 ')}</Tech>
            <Tech tone="muted">OUTCOME</Tech>
            <NumericReadout value={outcome} large />
            <IllustrativeTag />
          </>
        ) : null}
      </Group>
    </>
  );
}
