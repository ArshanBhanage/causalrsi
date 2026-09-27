/**
 * The shared motion language. Four tiers, critically damped, no bounce.
 * Pure: no DOM, no clock.
 */

export interface SpringSpec {
  /** rad/s */
  readonly omega: number;
  /** damping ratio; >= 1 means no overshoot */
  readonly zeta: number;
}

export interface MotionTier {
  readonly min: number;
  readonly max: number;
  readonly spring: SpringSpec;
}

export const MOTION = {
  /** interface response */
  ui: { min: 80, max: 180, spring: { omega: 32, zeta: 1.0 } },
  /** graph changes */
  graph: { min: 300, max: 700, spring: { omega: 14, zeta: 1.0 } },
  /** camera moves */
  camera: { min: 900, max: 2400, spring: { omega: 5.2, zeta: 1.05 } },
  /** ambient system movement */
  ambient: { min: 4000, max: 12000, spring: { omega: 1.2, zeta: 1.2 } },
} as const satisfies Record<string, MotionTier>;

export type MotionTierName = keyof typeof MOTION;

/** The lens follow spring: reaches 90% of a step in about 118ms with zero overshoot. */
export const LENS_SPRING: SpringSpec = { omega: 19.2, zeta: 1.0 };

export const HOLD_MS = 350;
export const HOLD_CANCEL_PX = 12;
export const LENS_RADIUS_PX = 120;
export const CROSSFADE_MS = 200;

/**
 * One step of a critically damped spring, integrated semi-implicitly.
 * Returns the new position and velocity. Never overshoots for zeta >= 1.
 */
export function stepSpring(
  position: number,
  velocity: number,
  target: number,
  dt: number,
  spec: SpringSpec = LENS_SPRING,
): readonly [number, number] {
  const clamped = Math.min(Math.max(dt, 0), 1 / 20);
  const k = spec.omega * spec.omega;
  const c = 2 * spec.zeta * spec.omega;
  const a = k * (target - position) - c * velocity;
  const v = velocity + a * clamped;
  const p = position + v * clamped;
  // Guard against numerical overshoot at large dt.
  if ((position <= target && p > target) || (position >= target && p < target)) {
    return [target, 0];
  }
  return [p, v];
}

/** Monotone smoothstep. `t` is clamped to [0,1]. */
export function smoothstep(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
}

/** Monotone quintic ease, used for camera work where smoothstep reads too abrupt. */
export function easeInOutQuint(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return x < 0.5 ? 16 * x ** 5 : 1 - ((-2 * x + 2) ** 5) / 2;
}

/** Linear interpolation that never leaves the closed endpoint interval. */
export function lerpValue(v0: number, v1: number, t: number): number {
  if (!Number.isFinite(t)) return v0;
  const x = Math.min(Math.max(t, 0), 1);
  if (x === 0) return v0;
  if (x === 1) return v1;
  const out = v0 + (v1 - v0) * x;
  const lo = Math.min(v0, v1);
  const hi = Math.max(v0, v1);
  return Math.min(Math.max(out, lo), hi);
}

/** Normalised progress of `value` within `[a, b]`, clamped. */
export function progress(value: number, a: number, b: number): number {
  if (!Number.isFinite(value)) return 0;
  if (a === b) return value >= b ? 1 : 0;
  return Math.min(Math.max((value - a) / (b - a), 0), 1);
}
