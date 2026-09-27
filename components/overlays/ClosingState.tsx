'use client';

import { SITE, SUPPORTING_LINE } from '@/content/site';
import { useObservatory } from '@/lib/store';
import styles from './Overlays.module.css';

/** The operators, the source and the channel, presented as the end of the process. */
export function ClosingState() {
  const p = useObservatory((s) => s.derived.p);
  const openingComplete = useObservatory((s) => s.openingComplete);
  const reveal = Math.min(1, Math.max(0, (p - 0.985) / 0.012));
  const opacity = openingComplete ? reveal : 0;
  if (opacity <= 0.01) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 'var(--gutter)',
        bottom: 'calc(var(--gutter) + 74px)',
        zIndex: 9,
        opacity,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 'min(52ch, 70vw)',
      }}
    >
      <p className={styles.text}>{SUPPORTING_LINE}</p>
      <span className={styles.key}>OPERATORS</span>
      {SITE.team.map((member) => (
        <span key={member.name} className={styles.text}>
          {`${member.name} \u2014 ${member.role}`}
        </span>
      ))}
      <a className={styles.channel} href={SITE.github} rel="noreferrer noopener" target="_blank">
        {'SOURCE github \u2197'}
      </a>
      {SITE.email ? (
        <a className={styles.channel} href={`mailto:${SITE.email}`}>
          OPEN CHANNEL
        </a>
      ) : null}
    </div>
  );
}
