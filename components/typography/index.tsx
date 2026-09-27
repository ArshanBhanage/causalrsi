'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ILLUSTRATIVE } from '@/content/site';
import { useObservatory } from '@/lib/store';
import styles from './Type.module.css';

export interface WithChildren {
  readonly children: ReactNode;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

export function Hero({ children, className, style }: WithChildren) {
  return (
    <span className={[styles.hero, className].filter(Boolean).join(' ')} style={style}>
      {children}
    </span>
  );
}

export function Display({ children, className, style }: WithChildren) {
  return (
    <span className={[styles.display, className].filter(Boolean).join(' ')} style={style}>
      {children}
    </span>
  );
}

export function Sub({ children, className, style }: WithChildren) {
  return (
    <span className={[styles.sub, className].filter(Boolean).join(' ')} style={style}>
      {children}
    </span>
  );
}

export type TechTone = 'default' | 'muted' | 'accent' | 'negative';

export interface TechProps extends WithChildren {
  readonly tone?: TechTone;
  readonly title?: string;
}

export function Tech({ children, tone = 'default', className, style, title }: TechProps) {
  const toneClass =
    tone === 'muted'
      ? styles.techMuted
      : tone === 'accent'
        ? styles.techAccent
        : tone === 'negative'
          ? styles.techNegative
          : styles.tech;
  return (
    <span className={[toneClass, className].filter(Boolean).join(' ')} style={style} title={title}>
      {children}
    </span>
  );
}

/** Causal notation such as `do(MEMORY = v04)` or `P(Y | do(X))`, never upper-cased. */
export function Notation({ children, className, style }: WithChildren) {
  return (
    <span className={[styles.notation, className].filter(Boolean).join(' ')} style={style}>
      {children}
    </span>
  );
}

export function Body({ children, className, style }: WithChildren) {
  return (
    <p className={[styles.body, className].filter(Boolean).join(' ')} style={style}>
      {children}
    </p>
  );
}

/** The marker every simulation-derived value must sit beside. */
export function IllustrativeTag({ className }: { readonly className?: string }) {
  return (
    <span className={[styles.tag, className].filter(Boolean).join(' ')}>{ILLUSTRATIVE}</span>
  );
}

export function Group({ children, className, style }: WithChildren) {
  return (
    <div className={[styles.group, className].filter(Boolean).join(' ')} style={style}>
      {children}
    </div>
  );
}

export function Row({ children, className, style }: WithChildren) {
  return (
    <div className={[styles.row, className].filter(Boolean).join(' ')} style={style}>
      {children}
    </div>
  );
}

export interface NumericReadoutProps {
  readonly value: number;
  readonly decimals?: number;
  readonly signed?: boolean;
  readonly large?: boolean;
  readonly durationMs?: number;
  readonly className?: string;
}

/**
 * Interpolates through intermediate values rather than swapping text, and holds the final
 * decimal precision throughout.
 */
export function NumericReadout({
  value,
  decimals = 3,
  signed = false,
  large = false,
  durationMs = 520,
  className,
}: NumericReadoutProps) {
  const reducedMotion = useObservatory((s) => s.reducedMotion);
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const startedAt = useRef<number | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (reducedMotion) {
      setShown(value);
      from.current = value;
      return;
    }
    if (Math.abs(value - from.current) < 10 ** -decimals) {
      setShown(value);
      return;
    }

    const start = from.current;
    startedAt.current = null;

    const tick = (now: number) => {
      if (startedAt.current === null) startedAt.current = now;
      const t = Math.min(1, (now - startedAt.current) / durationMs);
      const eased = t * t * (3 - 2 * t);
      const next = start + (value - start) * eased;
      setShown(Math.min(Math.max(next, Math.min(start, value)), Math.max(start, value)));
      if (t < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        setShown(value);
        from.current = value;
      }
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [value, decimals, durationMs, reducedMotion]);

  const text = shown.toFixed(decimals);
  const display = signed && shown >= 0 ? `+${text}` : text;

  return (
    <span className={[large ? styles.readoutLarge : styles.readout, className].filter(Boolean).join(' ')}>
      {display}
    </span>
  );
}

export { styles as typeStyles };
