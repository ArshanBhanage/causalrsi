/**
 * Quality tiers. Performance is treated as part of the design: the instrument degrades in
 * density, never in meaning.
 */

export type QualityMode = 'FULL' | 'REDUCED' | 'MINIMAL';

export interface QualityProfile {
  readonly mode: QualityMode;
  readonly dprCap: number;
  /** Instances per node archetype. */
  readonly archetypeDetail: number;
  /** Segments per edge curve. */
  readonly edgeSegments: number;
  /** Concurrent signal particles across the whole graph. */
  readonly signalBudget: number;
  readonly postPasses: number;
  readonly drawCallBudget: number;
}

export const QUALITY: Readonly<Record<QualityMode, QualityProfile>> = Object.freeze({
  FULL: {
    mode: 'FULL',
    dprCap: 2,
    archetypeDetail: 1,
    edgeSegments: 64,
    signalBudget: 180,
    postPasses: 2,
    drawCallBudget: 150,
  },
  REDUCED: {
    mode: 'REDUCED',
    dprCap: 1.5,
    archetypeDetail: 0.6,
    edgeSegments: 32,
    signalBudget: 96,
    postPasses: 1,
    drawCallBudget: 100,
  },
  MINIMAL: {
    mode: 'MINIMAL',
    dprCap: 1,
    archetypeDetail: 0.35,
    edgeSegments: 12,
    signalBudget: 40,
    postPasses: 0,
    drawCallBudget: 60,
  },
});

const ORDER: readonly QualityMode[] = ['FULL', 'REDUCED', 'MINIMAL'];

export function stepDown(mode: QualityMode): QualityMode {
  const i = ORDER.indexOf(mode);
  return (ORDER[Math.min(i + 1, ORDER.length - 1)] ?? 'MINIMAL') as QualityMode;
}

/** Frame-time ring buffer. Steps the tier down only, to avoid oscillation. */
export class FrameSampler {
  private readonly samples: number[] = [];

  private readonly capacity: number;

  private cursor = 0;

  private elapsed = 0;

  constructor(capacity = 120) {
    this.capacity = capacity;
  }

  push(dtMs: number): void {
    if (!Number.isFinite(dtMs) || dtMs <= 0) return;
    if (this.samples.length < this.capacity) {
      this.samples.push(dtMs);
    } else {
      this.samples[this.cursor] = dtMs;
      this.cursor = (this.cursor + 1) % this.capacity;
    }
    this.elapsed += dtMs;
  }

  median(): number {
    if (this.samples.length === 0) return 0;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }

  /** True once a 2 second window has been observed with a median above the threshold. */
  shouldDegrade(thresholdMs = 22, windowMs = 2000): boolean {
    if (this.elapsed < windowMs) return false;
    if (this.samples.length < 30) return false;
    return this.median() > thresholdMs;
  }

  reset(): void {
    this.samples.length = 0;
    this.cursor = 0;
    this.elapsed = 0;
  }
}

export interface DeviceHints {
  readonly coarsePointer: boolean;
  readonly deviceMemoryGb: number | null;
  readonly hardwareConcurrency: number | null;
  readonly reducedMotion: boolean;
}

export function initialMode(hints: DeviceHints): QualityMode {
  if (hints.coarsePointer) return 'REDUCED';
  if (hints.deviceMemoryGb !== null && hints.deviceMemoryGb <= 4) return 'REDUCED';
  if (hints.hardwareConcurrency !== null && hints.hardwareConcurrency <= 4) return 'REDUCED';
  return 'FULL';
}

export function readDeviceHints(): DeviceHints {
  if (typeof window === 'undefined') {
    return {
      coarsePointer: false,
      deviceMemoryGb: null,
      hardwareConcurrency: null,
      reducedMotion: false,
    };
  }
  const nav = window.navigator as Navigator & { deviceMemory?: number };
  return {
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    deviceMemoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    hardwareConcurrency:
      typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
}

export function webglAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl');
    return gl !== null;
  } catch {
    return false;
  }
}
