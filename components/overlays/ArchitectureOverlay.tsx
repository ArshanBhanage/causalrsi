'use client';

import { ARCHITECTURE_NOTES } from '@/content/site';
import { useObservatory } from '@/lib/store';
import styles from './Overlays.module.css';

const START = 0.655;
const END = 0.745;

/**
 * Revealed by the widest camera pull-back rather than by a menu item. One note at a time in a slot
 * the scene leaves free, so research information never becomes a wall of copy over the graph.
 */
export function ArchitectureOverlay() {
  const p = useObservatory((s) => s.derived.p);
  const openingComplete = useObservatory((s) => s.openingComplete);

  if (!openingComplete || p < START || p > END) return null;

  const span = (END - START) / ARCHITECTURE_NOTES.length;
  const raw = (p - START) / span;
  const index = Math.min(ARCHITECTURE_NOTES.length - 1, Math.floor(raw));
  const note = ARCHITECTURE_NOTES[index];
  if (!note) return null;

  const local = raw - index;
  const opacity = Math.min(1, local / 0.18) * (1 - Math.min(1, Math.max(0, (local - 0.82) / 0.18)));

  return (
    <div
      className={styles.architectureSlot}
      style={{ opacity }}
      aria-hidden="true"
    >
      <span className={styles.annotationKey}>{`ARCHITECTURE / ${note.key}`}</span>
      <span className={styles.annotationBody}>{note.body}</span>
      <span className={styles.annotationIndex}>
        {`${String(index + 1).padStart(2, '0')} / ${String(ARCHITECTURE_NOTES.length).padStart(2, '0')}`}
      </span>
    </div>
  );
}
