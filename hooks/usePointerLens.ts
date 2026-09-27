'use client';

import { useEffect, useRef } from 'react';
import { useObservatory } from '@/lib/store';
import { HOLD_CANCEL_PX, HOLD_MS } from '@/lib/motion';

export interface PointerRaw {
  /** Normalised device coordinates, -1 to 1. */
  ndc: { x: number; y: number };
  /** CSS pixels. */
  px: { x: number; y: number };
  down: boolean;
  downAt: number;
  downPx: { x: number; y: number };
  moved: number;
  inside: boolean;
}

/** Shared mutable pointer record, read once per frame inside the render loop. */
export const pointer: PointerRaw = {
  ndc: { x: 0, y: 0 },
  px: { x: 0, y: 0 },
  down: false,
  downAt: 0,
  downPx: { x: 0, y: 0 },
  moved: 0,
  inside: false,
};

/**
 * Tracks the raw pointer and the hold gesture. The damped lens position itself is integrated in
 * the render loop, not here, so latency is bounded by frame time rather than by event rate.
 */
export function usePointerLens(): void {
  const setLens = useObservatory((s) => s.setLens);
  const setCounterfactual = useObservatory((s) => s.setCounterfactual);
  const holdTimer = useRef<number | null>(null);

  useEffect(() => {
    document.documentElement.classList.add('lens-active');

    const clearHold = () => {
      if (holdTimer.current !== null) {
        window.clearTimeout(holdTimer.current);
        holdTimer.current = null;
      }
    };

    const onMove = (event: PointerEvent) => {
      pointer.px = { x: event.clientX, y: event.clientY };
      pointer.ndc = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: -((event.clientY / window.innerHeight) * 2 - 1),
      };
      pointer.inside = true;
      if (pointer.down) {
        pointer.moved = Math.hypot(
          event.clientX - pointer.downPx.x,
          event.clientY - pointer.downPx.y,
        );
        if (pointer.moved > HOLD_CANCEL_PX) {
          clearHold();
          setCounterfactual(null);
        }
      }
      setLens({ visible: true });
    };

    const onDown = (event: PointerEvent) => {
      pointer.down = true;
      pointer.downAt = event.timeStamp;
      pointer.downPx = { x: event.clientX, y: event.clientY };
      pointer.moved = 0;

      clearHold();
      holdTimer.current = window.setTimeout(() => {
        const target = useObservatory.getState().lens.target;
        const candidate =
          target.kind === 'node' && target.id !== null
            ? target.id
            : useObservatory.getState().interaction.selected;
        if (candidate) {
          setCounterfactual(candidate as never);
          setLens({ mode: 'REWIND' });
        }
      }, HOLD_MS);
    };

    const onUp = () => {
      pointer.down = false;
      pointer.moved = 0;
      clearHold();
      setCounterfactual(null);
    };

    const onLeave = () => {
      pointer.inside = false;
      onUp();
      setLens({ visible: false });
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onUp);
    document.addEventListener('pointerleave', onLeave);

    return () => {
      document.documentElement.classList.remove('lens-active');
      clearHold();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onUp);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [setLens, setCounterfactual]);
}
