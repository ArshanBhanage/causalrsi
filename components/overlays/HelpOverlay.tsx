'use client';

import { useEffect, useRef } from 'react';
import { SITE } from '@/content/site';
import { useObservatory } from '@/lib/store';
import styles from './Overlays.module.css';

const BINDINGS: readonly (readonly [string, string])[] = [
  ['\u2191 \u2193', 'previous / next phase'],
  ['1 \u2013 7', 'jump to a phase'],
  ['Tab', 'move between controls'],
  ['Enter / Space', 'select a component, apply an intervention'],
  ['Hold C', 'view the counterfactual'],
  ['R', 'reset the intervention'],
  ['S', 'toggle interface sound'],
  ['?', 'show or hide this panel'],
  ['Esc', 'clear selection'],
];

/** Keyboard reference, the project record, and the two channels. */
export function HelpOverlay() {
  const open = useObservatory((s) => s.helpOpen);
  const toggleHelp = useObservatory((s) => s.toggleHelp);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.veil} role="dialog" aria-modal="true" aria-label="Index and keyboard reference">
      <button ref={closeRef} type="button" className={styles.close} onClick={toggleHelp}>
        CLOSE
      </button>

      <div className={styles.columns}>
        <div className={styles.block}>
          <span className={styles.key}>WHAT THIS IS</span>
          <p className={styles.text}>{SITE.shortDescription}</p>
          <p className={styles.text}>{SITE.researchQuestion}</p>
        </div>

        <div className={styles.block}>
          <span className={styles.key}>APPROACH</span>
          <p className={styles.text}>{SITE.approach}</p>
        </div>

        <div className={styles.block}>
          <span className={styles.key}>STATUS</span>
          <p className={styles.text}>{SITE.status}</p>
        </div>

        <div className={styles.block}>
          <span className={styles.key}>OPERATORS</span>
          {SITE.team.map((member) => (
            <p key={member.name} className={styles.text}>
              {`${member.name} \u2014 ${member.role}`}
            </p>
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

        <div className={styles.block}>
          <span className={styles.key}>CONTROLS</span>
          <div className={styles.keys}>
            {BINDINGS.map(([cap, meaning]) => (
              <div key={cap} style={{ display: 'contents' }}>
                <span className={styles.keyCap}>{cap}</span>
                <span>{meaning}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
