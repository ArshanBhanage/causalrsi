'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ILLUSTRATIVE, SITE } from '@/content/site';
import { AGENT_0042, AGENT_0043, formatPercent } from '@/lib/causalSimulation';
import { useObservatory } from '@/lib/store';
import styles from './Opening.module.css';

/**
 * The system waking up. Beats are ordered and timed; assets load concurrently and progress is
 * expressed only through the state of the world, never through a loader.
 */
const BEATS = [
  { at: 120, key: 'points' },
  { at: 320, key: 'relationships' },
  { at: 460, key: 'system' },
  { at: 700, key: 'recovered' },
  { at: 940, key: 'expanded' },
  { at: 1080, key: 'agent' },
  { at: 1260, key: 'diagnostics' },
  { at: 1500, key: 'change' },
  { at: 1700, key: 'propagation' },
  { at: 1900, key: 'score' },
  { at: 2350, key: 'pause' },
  { at: 2500, key: 'percent' },
  { at: 2950, key: 'why' },
  { at: 3300, key: 'pullback' },
  { at: 3450, key: 'identity' },
  { at: 3750, key: 'tagline' },
] as const;

type BeatKey = (typeof BEATS)[number]['key'];

const SESSION_KEY = 'causalrsi.opening.seen';

export function OpeningSequence() {
  const completeOpening = useObservatory((s) => s.completeOpening);
  const reducedMotion = useObservatory((s) => s.reducedMotion);
  const openingComplete = useObservatory((s) => s.openingComplete);

  const [reached, setReached] = useState<ReadonlySet<BeatKey>>(new Set());
  const [done, setDone] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [shortened, setShortened] = useState(false);
  const timers = useRef<number[]>([]);

  const finish = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setReached(new Set(BEATS.map((b) => b.key)));
    setDone(true);
    completeOpening();
    try {
      window.sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* storage may be unavailable; the sequence simply replays */
    }
  }, [completeOpening]);

  useEffect(() => {
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      seen = false;
    }

    // Arriving on a shared deep link should not replay the introduction.
    if (window.location.hash.length > 1) seen = true;

    // A repeat visit in the same session shows only the identity beats.
    const scale = reducedMotion ? 0.36 : 1;
    const list = seen
      ? BEATS.filter((b) => b.key === 'identity' || b.key === 'tagline')
      : BEATS;
    setShortened(seen);

    const base = seen ? (list[0]?.at ?? 0) - 200 : 0;

    list.forEach((beat) => {
      const delay = Math.max(0, (beat.at - base) * scale);
      timers.current.push(
        window.setTimeout(() => {
          setReached((prev) => new Set([...prev, beat.key]));
        }, delay),
      );
    });

    const total = (list[list.length - 1]?.at ?? 0) - base;
    timers.current.push(window.setTimeout(finish, Math.max(400, total * scale + 260)));

    const onInput = (event: Event) => {
      if (event.type === 'keydown') {
        const key = (event as KeyboardEvent).key;
        if (key === 'Tab' || key === 'Shift') return;
      }
      finish();
    };

    window.addEventListener('wheel', onInput, { passive: true, once: true });
    window.addEventListener('keydown', onInput, { once: true });
    window.addEventListener('pointerdown', onInput, { once: true });
    window.addEventListener('touchstart', onInput, { passive: true, once: true });

    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
      window.removeEventListener('wheel', onInput);
      window.removeEventListener('keydown', onInput);
      window.removeEventListener('pointerdown', onInput);
      window.removeEventListener('touchstart', onInput);
    };
  }, [finish, reducedMotion]);

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setRemoved(true), 520);
    return () => window.clearTimeout(timer);
  }, [done]);

  const has = (key: BeatKey) => reached.has(key);
  const hidden = done && openingComplete;
  if (removed) return null;

  return (
    <div className={styles.layer} style={{ opacity: hidden ? 0 : 1, transition: 'opacity 420ms' }}>
      {!shortened ? (
        <>
          <span className={`${styles.beat} ${styles.system} ${has('system') ? styles.on : ''}`}>
            SYSTEM / 000
          </span>
          <span className={`${styles.beat} ${styles.recovered} ${has('recovered') ? styles.on : ''}`}>
            AGENT STATE RECOVERED
          </span>
          <span className={`${styles.beat} ${styles.agent} ${has('agent') ? styles.on : ''}`}>
            {AGENT_0042.id}
          </span>

          <div className={`${styles.beat} ${styles.diag} ${has('diagnostics') ? styles.on : ''}`}>
            <span>SUBSYSTEMS 08 / RELATIONS 14</span>
            <span>LEDGER CHAIN OK</span>
            <span>OBSERVED BEHAVIOUR ONLY</span>
          </div>

          <div className={`${styles.beat} ${styles.score} ${has('score') ? styles.on : ''}`}>
            <span>
              {AGENT_0042.score.toFixed(3)}
              {has('propagation') ? ` \u2192 ${AGENT_0043.score.toFixed(3)}` : ''}
            </span>
            <span className={styles.tag}>{ILLUSTRATIVE}</span>
          </div>

          <div className={`${styles.percent} ${has('percent') && !has('why') ? styles.on : ''}`}>
            {formatPercent(AGENT_0042.score, AGENT_0043.score)}
            <span className={styles.tag}>{ILLUSTRATIVE}</span>
          </div>

          <div className={`${styles.why} ${has('why') && !has('identity') ? styles.on : ''}`}>
            BUT
            <br />
            WHY?
          </div>
        </>
      ) : null}

      <div className={`${styles.identity} ${has('identity') ? styles.on : ''}`}>
        CAUSAL
        <span className={styles.identityLine2}>RSI</span>
      </div>

      <div className={`${styles.identityTag} ${has('tagline') ? styles.on : ''}`}>
        {SITE.tagline}
      </div>

      {!done ? (
        <button type="button" className={styles.skip} onClick={finish}>
          SKIP
        </button>
      ) : null}
    </div>
  );
}
