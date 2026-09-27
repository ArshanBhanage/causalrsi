/**
 * Scroll is time. `observatoryState(p, interaction)` is a pure, total function of normalised
 * scroll progress, so reverse scroll restores state exactly by construction.
 */

import {
  ATTRIBUTION,
  type ComponentId,
  type Intervention,
} from './causalSimulation';
import type { Vec3 } from './graphLayout';
import { easeInOutQuint, progress } from './motion';

export const PHASES = [
  'AGENT_N',
  'MODIFICATIONS',
  'AGENT_N_PLUS_1',
  'CAUSAL_ATTRIBUTION',
  'COUNTERFACTUALS',
  'CREDIT_ASSIGNMENT',
  'RECURSIVE_IMPROVEMENT',
] as const;

export type NarrativePhase = (typeof PHASES)[number];

export const SCENES = [
  'OBSERVE',
  'MUTATION',
  'EVALUATION',
  'ATTRIBUTION',
  'INTERVENTION',
  'COUNTERFACTUAL',
  'CREDIT',
  'RECURSION',
] as const;

export type SceneName = (typeof SCENES)[number];

/** Lower bound of each phase; the upper bound belongs to the later phase. */
export const PHASE_BOUNDS: readonly number[] = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9];

/** The six-state cycle shown in the system map. */
export const CYCLE = ['OBSERVE', 'MODIFY', 'EVALUATE', 'INTERVENE', 'ATTRIBUTE', 'RECURSE'] as const;

export type CycleStage = (typeof CYCLE)[number];

export interface CameraPose {
  readonly position: Vec3;
  readonly target: Vec3;
  readonly fov: number;
}

interface Keyframe extends CameraPose {
  readonly at: number;
  readonly stage: string;
}

export const CAMERA_KEYFRAMES: readonly Keyframe[] = [
  {
    at: 0,
    stage: 'macro relationship',
    position: { x: -2.9, y: 0.45, z: 4.3 },
    target: { x: -3.6, y: 0.1, z: 0 },
    fov: 38,
  },
  {
    at: 0.15,
    stage: 'whole agent',
    position: { x: -0.35, y: 0.5, z: 9.1 },
    target: { x: -0.35, y: 0, z: 0 },
    fov: 44,
  },
  {
    at: 0.32,
    stage: 'subsystem interior',
    position: { x: -2.6, y: 0.3, z: 3.4 },
    target: { x: -4.3, y: -0.2, z: 0 },
    fov: 40,
  },
  {
    at: 0.5,
    stage: 'causal depth rotation',
    position: { x: 6.4, y: 1.7, z: 6.2 },
    target: { x: 0, y: 0, z: 0 },
    fov: 48,
  },
  {
    at: 0.66,
    stage: 'counterfactual worlds',
    position: { x: 0, y: 0.9, z: 12.6 },
    target: { x: 0, y: 0, z: -1.6 },
    fov: 52,
  },
  {
    at: 0.82,
    stage: 'single credited path',
    position: { x: -2.4, y: 0.7, z: 6.4 },
    target: { x: 3.2, y: 0, z: 0 },
    fov: 44,
  },
  {
    at: 1,
    stage: 'recursion',
    position: { x: 0, y: 0.2, z: 14.5 },
    target: { x: 0, y: 0, z: 0 },
    fov: 50,
  },
];

export interface InteractionState {
  readonly selected: ComponentId | null;
  readonly intervention: Intervention | null;
  readonly counterfactualOf: ComponentId | null;
  readonly reducedMotion: boolean;
}

export const IDLE_INTERACTION: InteractionState = Object.freeze({
  selected: null,
  intervention: null,
  counterfactualOf: null,
  reducedMotion: false,
});

export interface ObservatoryState {
  /** Quantised to three decimals. */
  readonly p: number;
  readonly phase: NarrativePhase;
  /** 1-based, 1 to 7. */
  readonly phaseIndex: number;
  /** Progress within the active phase, 0 to 1. */
  readonly phaseProgress: number;
  readonly scene: SceneName;
  readonly cycleStage: CycleStage;
  readonly camera: CameraPose;
  /** 0 at AGENT_0042, 1 once the mutation has fully resolved into AGENT_0043. */
  readonly mutation: number;
  /** 0 to 1 blend of the attribution decomposition layout. */
  readonly decomposition: number;
  /** 0 to 1 blend of the counterfactual world at depth Z-3. */
  readonly counterfactual: number;
  /** 0 to 1 progress of backward credit propagation. */
  readonly credit: number;
  /** 0 = linear chain, 1 = tree, 2 = morphed into the causal graph. */
  readonly recursion: number;
  /** The score to display, interpolated between the two agent versions. */
  readonly displayScore: number;
  readonly selected: ComponentId | null;
  readonly intervention: Intervention | null;
}

export function clampProgress(p: number): number {
  if (!Number.isFinite(p)) return 0;
  return Math.min(Math.max(p, 0), 1);
}

export function quantiseProgress(p: number): number {
  return Math.round(clampProgress(p) * 1000) / 1000;
}

export function phaseIndexOf(p: number): number {
  const q = clampProgress(p);
  let index = 1;
  for (let i = 0; i < PHASE_BOUNDS.length; i += 1) {
    const bound = PHASE_BOUNDS[i];
    if (bound !== undefined && q >= bound) index = i + 1;
  }
  return index;
}

export function phaseOf(p: number): NarrativePhase {
  return PHASES[phaseIndexOf(p) - 1] as NarrativePhase;
}

const PHASE_TO_SCENE: Readonly<Record<NarrativePhase, SceneName>> = {
  AGENT_N: 'OBSERVE',
  MODIFICATIONS: 'MUTATION',
  AGENT_N_PLUS_1: 'EVALUATION',
  CAUSAL_ATTRIBUTION: 'ATTRIBUTION',
  COUNTERFACTUALS: 'COUNTERFACTUAL',
  CREDIT_ASSIGNMENT: 'CREDIT',
  RECURSIVE_IMPROVEMENT: 'RECURSION',
};

const PHASE_TO_CYCLE: Readonly<Record<NarrativePhase, CycleStage>> = {
  AGENT_N: 'OBSERVE',
  MODIFICATIONS: 'MODIFY',
  AGENT_N_PLUS_1: 'EVALUATE',
  CAUSAL_ATTRIBUTION: 'ATTRIBUTE',
  COUNTERFACTUALS: 'INTERVENE',
  CREDIT_ASSIGNMENT: 'ATTRIBUTE',
  RECURSIVE_IMPROVEMENT: 'RECURSE',
};

export function sceneOf(p: number): SceneName {
  // Within CAUSAL_ATTRIBUTION the second half hands over to the interactive intervention scene.
  const phase = phaseOf(p);
  if (phase === 'CAUSAL_ATTRIBUTION' && p >= 0.525) return 'INTERVENTION';
  return PHASE_TO_SCENE[phase];
}

function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export function cameraAt(p: number): CameraPose {
  const q = clampProgress(p);
  let lo = CAMERA_KEYFRAMES[0] as Keyframe;
  let hi = CAMERA_KEYFRAMES[CAMERA_KEYFRAMES.length - 1] as Keyframe;

  for (let i = 0; i < CAMERA_KEYFRAMES.length - 1; i += 1) {
    const a = CAMERA_KEYFRAMES[i] as Keyframe;
    const b = CAMERA_KEYFRAMES[i + 1] as Keyframe;
    if (q >= a.at && q <= b.at) {
      lo = a;
      hi = b;
      break;
    }
  }

  const span = hi.at - lo.at;
  const t = span === 0 ? 0 : easeInOutQuint((q - lo.at) / span);

  return {
    position: lerpVec(lo.position, hi.position, t),
    target: lerpVec(lo.target, hi.target, t),
    fov: lo.fov + (hi.fov - lo.fov) * t,
  };
}

const BASELINE_SCORE = 0.714;
const FACTUAL_SCORE = 0.842;

/**
 * The single source of truth for what the world looks like at a given scroll position.
 * Pure and total: any `p`, finite or not, in range or not, yields exactly one state.
 */
export function observatoryState(
  p: number,
  interaction: InteractionState = IDLE_INTERACTION,
): ObservatoryState {
  const q = quantiseProgress(p);
  const index = phaseIndexOf(q);
  const phase = PHASES[index - 1] as NarrativePhase;
  const lower = PHASE_BOUNDS[index - 1] ?? 0;
  const upper = PHASE_BOUNDS[index] ?? 1;

  const mutation = progress(q, 0.16, 0.29);
  const decomposition = progress(q, 0.45, 0.58);
  const scrollCounterfactual = progress(q, 0.6, 0.71);
  const credit = progress(q, 0.75, 0.89);
  const recursion = progress(q, 0.9, 1) * 2;

  const heldCounterfactual = interaction.counterfactualOf === null ? 0 : 1;
  const counterfactual = Math.max(scrollCounterfactual, heldCounterfactual);

  const evaluation = progress(q, 0.3, 0.4);
  const displayScore =
    BASELINE_SCORE + (FACTUAL_SCORE - BASELINE_SCORE) * Math.max(evaluation, mutation === 1 ? 1 : 0);

  return Object.freeze({
    p: q,
    phase,
    phaseIndex: index,
    phaseProgress: progress(q, lower, upper),
    scene: sceneOf(q),
    cycleStage: PHASE_TO_CYCLE[phase],
    camera: cameraAt(q),
    mutation,
    decomposition,
    counterfactual,
    credit,
    recursion,
    displayScore: Math.round(displayScore * 1000) / 1000,
    selected: interaction.selected,
    intervention: interaction.intervention,
  });
}

/**
 * How strongly hero typography occupies the frame at `p`. The navigation chrome fades against
 * this so that display type and interface text never compete for the same pixels.
 */
export function heroStrength(p: number): number {
  const window = (a: number, b: number): number => {
    const fade = 0.02;
    const rise = Math.min(1, Math.max(0, (p - a) / fade));
    const fall = 1 - Math.min(1, Math.max(0, (p - (b - fade)) / fade));
    return Math.min(rise, fall);
  };
  return Math.max(
    window(0.352, 0.452), // BETTER. / BUT WHY?
    window(0.762, 0.902), // WHAT CAUSED THE CHANGE?
    window(0.958, 1.001), // closing statement
  );
}

/** Scroll position that lands on the start of a given phase, used by the index navigation. */
export function progressForPhase(phase: NarrativePhase): number {
  const i = PHASES.indexOf(phase);
  const bound = PHASE_BOUNDS[i];
  return bound === undefined ? 0 : Math.min(bound + 0.02, 1);
}

/** Convenience for scenes that need the canonical illustrative attribution. */
export const CANONICAL_ATTRIBUTION = ATTRIBUTION;
