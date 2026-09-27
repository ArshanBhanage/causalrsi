'use client';

import { useEffect, useRef } from 'react';
import { CYCLE, PHASES, heroStrength, progressForPhase } from '@/lib/choreography';
import { SITE } from '@/content/site';
import { useObservatory } from '@/lib/store';
import { scrollToProgress } from '@/hooks/useScrollProgress';
import styles from './Nav.module.css';

const INDEX: readonly { readonly label: string; readonly phase: (typeof PHASES)[number] }[] = [
  { label: 'OBSERVE', phase: 'AGENT_N' },
  { label: 'MODIFY', phase: 'MODIFICATIONS' },
  { label: 'EVALUATE', phase: 'AGENT_N_PLUS_1' },
  { label: 'ATTRIBUTE', phase: 'CAUSAL_ATTRIBUTION' },
  { label: 'INTERVENE', phase: 'COUNTERFACTUALS' },
  { label: 'RECURSE', phase: 'RECURSIVE_IMPROVEMENT' },
];

function TimelineIndicator() {
  const ref = useRef<HTMLDivElement>(null);
  const p = useObservatory((s) => s.derived.p);

  useEffect(() => {
    const el = ref.current;
    if (el) el.style.transform = `scaleX(${Math.max(0.001, p)})`;
  }, [p]);

  return <div ref={ref} className={styles.timeline} style={{ width: '100%' }} />;
}

function SystemMap() {
  const stage = useObservatory((s) => s.derived.cycleStage);
  const activeIndex = CYCLE.indexOf(stage);

  return (
    <nav className={styles.map} aria-label="Causal process position">
      {CYCLE.map((name, i) => (
        <div key={name} className={styles.mapItem}>
          {i > 0 ? <span className={styles.link} /> : null}
          <span
            className={
              i === activeIndex ? styles.dotActive : i < activeIndex ? styles.dotPast : styles.dot
            }
            aria-current={i === activeIndex ? 'step' : undefined}
            title={name}
          />
        </div>
      ))}
      <span className={styles.stageName}>{stage}</span>
      <span className={styles.stageCount}>
        {`${String(activeIndex + 1).padStart(2, '0')} / ${String(CYCLE.length).padStart(2, '0')}`}
      </span>
    </nav>
  );
}

function StateIndex() {
  const phase = useObservatory((s) => s.derived.phase);
  const p = useObservatory((s) => s.derived.p);
  const yielded = 1 - heroStrength(p) * 0.88;

  return (
    <nav
      className={styles.index}
      aria-label="Narrative index"
      style={{ opacity: yielded, transition: 'opacity var(--t-graph) var(--ease)' }}
    >
      {INDEX.map((entry, i) => {
        const active = phase === entry.phase;
        return (
          <button
            key={entry.label}
            type="button"
            className={active ? styles.indexItemActive : styles.indexItem}
            onClick={() => scrollToProgress(progressForPhase(entry.phase))}
            aria-current={active ? 'true' : undefined}
          >
            <span>{String(i + 1).padStart(2, '0')}</span>
            <span className={styles.indexRule} />
            <span>{entry.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function NavShell() {
  const agent = useObservatory((s) => s.model.factual.id);
  const soundOn = useObservatory((s) => s.soundOn);
  const toggleSound = useObservatory((s) => s.toggleSound);
  const toggleHelp = useObservatory((s) => s.toggleHelp);
  const openingComplete = useObservatory((s) => s.openingComplete);

  if (!openingComplete) return <TimelineIndicator />;

  return (
    <>
      <TimelineIndicator />
      <header className={styles.shell}>
        <span className={styles.identity}>{SITE.project}</span>
        <div className={styles.right}>
          <span className={styles.meta}>{agent.replace('AGENT_', 'AGENT / ')}</span>
          <button
            type="button"
            className={soundOn ? styles.toggleOn : styles.toggle}
            onClick={toggleSound}
            aria-pressed={soundOn}
            aria-label={soundOn ? 'Turn interface sound off' : 'Turn interface sound on'}
          >
            {soundOn ? 'SOUND \u25cf' : 'SOUND \u25cb'}
          </button>
          <button
            type="button"
            className={styles.toggle}
            onClick={toggleHelp}
            aria-label="Open keyboard help"
          >
            INDEX
          </button>
        </div>
      </header>
      <SystemMap />
      <StateIndex />
    </>
  );
}
