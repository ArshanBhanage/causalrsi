'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { screenPositions } from '@/lib/projection';

export interface AnchoredLabelProps {
  /** Graph node id to anchor to. */
  readonly anchor: string;
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly opacity?: number;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * Sits within a fixed distance of the projected geometry it annotates, and hides itself when that
 * geometry leaves the frame. Positioned in a rAF loop so the graph never re-renders React.
 */
export function AnchoredLabel({
  anchor,
  offsetX = 16,
  offsetY = -10,
  opacity = 1,
  className,
  children,
}: AnchoredLabelProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const el = ref.current;
      const point = screenPositions[anchor];
      if (el) {
        if (point && point.visible) {
          el.style.transform = `translate3d(${Math.round(point.x + offsetX)}px, ${Math.round(
            point.y + offsetY,
          )}px, 0)`;
          el.style.opacity = String(opacity);
        } else {
          el.style.opacity = '0';
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [anchor, offsetX, offsetY, opacity]);

  return (
    <span
      ref={ref}
      className={className}
      style={{ position: 'fixed', top: 0, left: 0, opacity: 0, willChange: 'transform' }}
    >
      {children}
    </span>
  );
}
