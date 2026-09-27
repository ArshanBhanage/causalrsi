'use client';

import { useEffect, useRef } from 'react';
import { EDGES, NODES } from '@/lib/causalSimulation';
import { LENS_SPRING, stepSpring } from '@/lib/motion';
import { useObservatory } from '@/lib/store';
import { pointer } from '@/hooks/usePointerLens';
import styles from './CursorLayer.module.css';

/**
 * The cursor is an instrument, not a pointer. One mode label at a time, one traced path, no
 * rectangular panels anywhere.
 */
export function CursorLayer() {
  const lensRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<HTMLSpanElement>(null);
  const targetRef = useRef<HTMLSpanElement>(null);
  const traceRef = useRef<HTMLDivElement>(null);
  const spring = useRef({ x: 0, y: 0, vx: 0, vy: 0 });

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let running = true;

    const tick = (now: number) => {
      if (!running) return;
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;

      const store = useObservatory.getState();
      const reduced = store.reducedMotion;
      const s = spring.current;

      if (reduced) {
        s.x = pointer.px.x;
        s.y = pointer.px.y;
      } else {
        [s.x, s.vx] = stepSpring(s.x, s.vx, pointer.px.x, dt, LENS_SPRING);
        [s.y, s.vy] = stepSpring(s.y, s.vy, pointer.px.y, dt, LENS_SPRING);
      }

      const lens = lensRef.current;
      if (lens) {
        lens.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`;
        lens.style.opacity = pointer.inside && store.openingComplete ? '1' : '0';
      }

      const mode = modeRef.current;
      if (mode) {
        const text = store.lens.mode === 'EXPLORE' ? '' : store.lens.mode;
        if (mode.textContent !== text) mode.textContent = text;
      }

      const targetEl = targetRef.current;
      if (targetEl) {
        const id = store.lens.target.id ?? '';
        const node = NODES.find((n) => n.id === id);
        const version = node ? store.model.factual.versions[node.id] : null;
        const text = node ? `${node.id} ${version ?? ''}`.trim() : id;
        if (targetEl.textContent !== text) targetEl.textContent = text;
      }

      const trace = traceRef.current;
      if (trace) {
        const path = store.tracedPath;
        if (path.length === 0) {
          trace.style.opacity = '0';
        } else {
          const chain: string[] = [];
          for (const edgeId of path) {
            const edge = EDGES.find((e) => e.id === edgeId);
            if (!edge) continue;
            if (chain.length === 0) chain.push(edge.from);
            chain.push(edge.to);
          }
          const prefix = store.interaction.counterfactualOf ? 'COUNTERFACTUAL' : 'OBSERVED';
          const text = `${prefix}: ${chain.join(' \u2192 ')}`;
          if (trace.textContent !== text) trace.textContent = text;
          trace.style.opacity = '1';
        }
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
      } else if (!running) {
        running = true;
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div className={styles.layer}>
      <div ref={lensRef} className={styles.lens} style={{ opacity: 0 }}>
        <span className={styles.crosshair} />
        <span className={styles.crosshairV} />
        <span ref={modeRef} className={styles.mode} />
        <span ref={targetRef} className={styles.targetId} />
      </div>
      <div ref={traceRef} className={styles.trace} style={{ opacity: 0 }} />
    </div>
  );
}
