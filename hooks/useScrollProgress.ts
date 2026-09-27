'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import { useObservatory } from '@/lib/store';

/** The active smooth-scroll instance, so programmatic jumps are not fought by it. */
let activeLenis: Lenis | null = null;

/**
 * Drives `p` from the document scroll. Lenis smooths the input; nothing tweens scene objects
 * directly, so reverse scroll restores state exactly.
 */
export function useScrollProgress(reducedMotion: boolean): void {
  const setProgress = useObservatory((s) => s.setProgress);

  useEffect(() => {
    const read = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max <= 0 ? 0 : window.scrollY / max);
    };

    read();

    if (reducedMotion) {
      window.addEventListener('scroll', read, { passive: true });
      window.addEventListener('resize', read);
      return () => {
        window.removeEventListener('scroll', read);
        window.removeEventListener('resize', read);
      };
    }

    const lenis = new Lenis({
      duration: 1.1,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.4,
      smoothWheel: true,
    });

    activeLenis = lenis;

    let frame = 0;
    let running = true;

    const raf = (time: number) => {
      if (!running) return;
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    lenis.on('scroll', ({ scroll, limit }: { scroll: number; limit: number }) => {
      setProgress(limit <= 0 ? 0 : scroll / limit);
    });

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
      } else if (!running) {
        running = true;
        frame = requestAnimationFrame(raf);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    window.addEventListener('resize', read);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', read);
      if (activeLenis === lenis) activeLenis = null;
      lenis.destroy();
    };
  }, [reducedMotion, setProgress]);
}

/**
 * Scrolls the document so that `p` becomes the active progress. Routed through the smooth-scroll
 * instance when one is running, otherwise straight to the window.
 */
export function scrollToProgress(p: number, immediate = false): void {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const top = Math.max(0, max * Math.min(Math.max(p, 0), 1));
  if (activeLenis) {
    if (immediate) activeLenis.scrollTo(top, { immediate: true });
    else activeLenis.scrollTo(top, { duration: 1.1 });
    return;
  }
  window.scrollTo({ top, behavior: immediate ? 'auto' : 'smooth' });
}

/**
 * Jumps to `p` and re-asserts it across the next few frames, so a late layout pass (web fonts,
 * the scroll track settling) cannot leave a deep link parked at the top of the document.
 */
export function settleAtProgress(p: number): () => void {
  const timers: number[] = [];
  const apply = () => scrollToProgress(p, true);
  apply();
  for (const delay of [0, 60, 180, 420, 900]) {
    timers.push(window.setTimeout(apply, delay));
  }
  return () => timers.forEach((t) => window.clearTimeout(t));
}
