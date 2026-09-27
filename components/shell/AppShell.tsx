'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { PHASES, progressForPhase } from '@/lib/choreography';
import { format, parseVerbose } from '@/lib/stateCodec';
import { webglAvailable } from '@/lib/performance';
import { useObservatory } from '@/lib/store';
import { useAudioLayer } from '@/hooks/useAudioLayer';
import { useKeyBindings } from '@/hooks/useKeyBindings';
import { usePointerLens, pointer } from '@/hooks/usePointerLens';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { settleAtProgress, useScrollProgress } from '@/hooks/useScrollProgress';
import { NavShell } from '@/components/navigation/NavShell';
import { ArchitectureOverlay } from '@/components/overlays/ArchitectureOverlay';
import { ClosingState } from '@/components/overlays/ClosingState';
import { HelpOverlay } from '@/components/overlays/HelpOverlay';
import { StaticFallback } from '@/components/overlays/StaticFallback';
import { SceneLayer } from '@/components/scenes/SceneLayer';
import { CursorLayer } from './CursorLayer';
import { LiveRegion } from './LiveRegion';
import { OpeningSequence } from './OpeningSequence';
import styles from './AppShell.module.css';

/** The WebGL chunk loads dynamically and concurrently with the opening sequence. */
const Observatory = dynamic(() => import('@/components/canvas/Observatory'), {
  ssr: false,
  loading: () => null,
});

/** Pointer parallax across the DOM typography band. */
function useParallax(
  ref: React.RefObject<HTMLDivElement | null>,
  reducedMotion: boolean,
): void {
  useEffect(() => {
    if (reducedMotion) {
      if (ref.current) ref.current.style.transform = 'none';
      return;
    }
    if (window.matchMedia('(pointer: coarse)').matches) return;

    let frame = 0;
    let x = 0;
    let y = 0;

    const tick = () => {
      const tx = pointer.ndc.x * 6;
      const ty = -pointer.ndc.y * 6;
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      if (ref.current) ref.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref, reducedMotion]);
}

/** Reads the fragment on load and writes it back, throttled, on meaningful state changes. */
function useDeepLink(): void {
  const hydrate = useObservatory((s) => s.hydrate);
  const openingComplete = useObservatory((s) => s.openingComplete);
  const phase = useObservatory((s) => s.derived.phase);
  const selected = useObservatory((s) => s.interaction.selected);
  const intervention = useObservatory((s) => s.interaction.intervention);
  const p = useObservatory((s) => s.derived.p);
  const applied = useRef(false);
  const lastWrite = useRef(0);

  useEffect(() => {
    if (!openingComplete) return;

    let cancelSettle: (() => void) | null = null;

    const restore = (fragment: string): void => {
      if (fragment.length <= 1) return;
      const outcome = parseVerbose(fragment);
      if (outcome.rejected !== null) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[observatory] ignoring URL fragment: rejected field "${outcome.rejected}"`);
        }
        return;
      }
      hydrate({
        p: outcome.state.p,
        selected: outcome.state.selected,
        intervention: outcome.state.intervention,
      });
      cancelSettle?.();
      cancelSettle = settleAtProgress(outcome.state.p);
    };

    if (!applied.current) {
      applied.current = true;
      restore(window.location.hash);
    }

    // A hash edit or an in-page link is a same-document navigation, so it has to be handled too.
    const onHashChange = () => {
      const fragment = window.location.hash;
      const current = format({ p, phase, selected, intervention });
      if (fragment.slice(1) === current) return;
      restore(fragment);
    };

    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      cancelSettle?.();
    };
    // `p`, `phase`, `selected` and `intervention` are read inside the listener only to skip
    // echoes of our own writes, so they are intentionally not dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrate, openingComplete]);

  useEffect(() => {
    if (!openingComplete) return;

    const write = () => {
      lastWrite.current = performance.now();
      const text = format({ p, phase, selected, intervention });
      if (window.location.hash.slice(1) !== text) {
        window.history.replaceState(null, '', `#${text}`);
      }
    };

    // Throttled to 10 writes a second, but always with a trailing write so the URL cannot be
    // left holding a stale state.
    const since = performance.now() - lastWrite.current;
    if (since >= 100) {
      write();
      return;
    }
    const timer = window.setTimeout(write, 100 - since);
    return () => window.clearTimeout(timer);
  }, [openingComplete, p, phase, selected, intervention]);
}

export function AppShell() {
  const reducedMotion = useReducedMotion();
  const [webgl, setWebglLocal] = useState(true);
  const setWebgl = useObservatory((s) => s.setWebgl);
  const parallaxRef = useRef<HTMLDivElement>(null);

  useScrollProgress(reducedMotion);
  usePointerLens();
  useKeyBindings();
  useAudioLayer();
  useDeepLink();
  useParallax(parallaxRef, reducedMotion);

  useEffect(() => {
    const ok = webglAvailable();
    setWebglLocal(ok);
    setWebgl(ok);
  }, [setWebgl]);

  return (
    <div className={styles.root}>
      <a href="#observatory-content" className="visually-hidden">
        Skip to the text version of this research instrument
      </a>

      {webgl ? (
        <>
          <div className={styles.canvasHost}>
            <Observatory />
          </div>
          <div ref={parallaxRef} className={styles.parallax}>
            <SceneLayer />
          </div>
          <ArchitectureOverlay />
          <ClosingState />
          <OpeningSequence />
          <CursorLayer />
          <NavShell />
          <HelpOverlay />
          <div className={styles.track} aria-hidden="true" />
          <span className="visually-hidden">
            {`Phases: ${PHASES.map(
              (phase) => `${phase} at ${Math.round(progressForPhase(phase) * 100)} percent`,
            ).join('; ')}`}
          </span>
        </>
      ) : (
        <p className={styles.noWebgl}>
          This interactive instrument requires WebGL. The full record is below.
        </p>
      )}

      <LiveRegion />
      <StaticFallback visible={!webgl} />
    </div>
  );
}
