/**
 * URL fragment codec. Total over inputs of at most 2048 characters; never throws.
 *
 * Grammar:  p=<0.000-1.000>&ph=<PHASE>&n=<COMPONENT|->&iv=<COMPONENT:version|->
 * Example:  p=0.662&ph=COUNTERFACTUALS&n=MEMORY&iv=MEMORY:v04
 */

import { COMPONENT_IDS, type ComponentId, type Intervention } from './causalSimulation';
import { PHASES, type NarrativePhase } from './choreography';

export const MAX_FRAGMENT_LENGTH = 2048;
export const NONE = '-';

export interface EncodedState {
  readonly p: number;
  readonly phase: NarrativePhase;
  readonly selected: ComponentId | null;
  readonly intervention: Intervention | null;
}

export const INITIAL_ENCODED_STATE: EncodedState = Object.freeze({
  p: 0,
  phase: PHASES[0],
  selected: null,
  intervention: null,
});

const quantise = (p: number): number => {
  if (!Number.isFinite(p)) return 0;
  const clamped = Math.min(Math.max(p, 0), 1);
  return Math.round(clamped * 1000) / 1000;
};

const isComponentId = (v: string): v is ComponentId =>
  (COMPONENT_IDS as readonly string[]).includes(v);

const isPhase = (v: string): v is NarrativePhase => (PHASES as readonly string[]).includes(v);

export function format(state: EncodedState): string {
  const p = quantise(state.p).toFixed(3);
  const phase = state.phase;
  const n = state.selected ?? NONE;
  const iv = state.intervention
    ? `${state.intervention.component}:${state.intervention.version}`
    : NONE;
  return `p=${p}&ph=${phase}&n=${n}&iv=${iv}`;
}

export interface ParseOutcome {
  readonly state: EncodedState;
  /** Field name that caused a fall back to the initial state, if any. */
  readonly rejected: string | null;
}

export function parseVerbose(input: string): ParseOutcome {
  if (typeof input !== 'string' || input.length > MAX_FRAGMENT_LENGTH) {
    return { state: INITIAL_ENCODED_STATE, rejected: 'length' };
  }

  const text = input.startsWith('#') ? input.slice(1) : input;
  if (text.length === 0) return { state: INITIAL_ENCODED_STATE, rejected: null };

  const fields = new Map<string, string>();
  for (const part of text.split('&')) {
    const eq = part.indexOf('=');
    if (eq <= 0) return { state: INITIAL_ENCODED_STATE, rejected: 'syntax' };
    const key = part.slice(0, eq);
    if (!['p', 'ph', 'n', 'iv'].includes(key)) {
      return { state: INITIAL_ENCODED_STATE, rejected: key };
    }
    if (fields.has(key)) return { state: INITIAL_ENCODED_STATE, rejected: key };
    fields.set(key, part.slice(eq + 1));
  }

  for (const required of ['p', 'ph', 'n', 'iv']) {
    if (!fields.has(required)) return { state: INITIAL_ENCODED_STATE, rejected: required };
  }

  const rawP = fields.get('p') as string;
  const p = Number(rawP);
  if (rawP.trim() === '' || !Number.isFinite(p) || p < 0 || p > 1) {
    return { state: INITIAL_ENCODED_STATE, rejected: 'p' };
  }

  const rawPhase = fields.get('ph') as string;
  if (!isPhase(rawPhase)) return { state: INITIAL_ENCODED_STATE, rejected: 'ph' };

  const rawNode = fields.get('n') as string;
  let selected: ComponentId | null = null;
  if (rawNode !== NONE) {
    if (!isComponentId(rawNode)) return { state: INITIAL_ENCODED_STATE, rejected: 'n' };
    selected = rawNode;
  }

  const rawIv = fields.get('iv') as string;
  let intervention: Intervention | null = null;
  if (rawIv !== NONE) {
    const colon = rawIv.indexOf(':');
    if (colon <= 0) return { state: INITIAL_ENCODED_STATE, rejected: 'iv' };
    const component = rawIv.slice(0, colon);
    const version = rawIv.slice(colon + 1);
    if (!isComponentId(component) || !/^v\d{2,}$/.test(version)) {
      return { state: INITIAL_ENCODED_STATE, rejected: 'iv' };
    }
    intervention = { component, version };
  }

  return {
    state: Object.freeze({ p: quantise(p), phase: rawPhase, selected, intervention }),
    rejected: null,
  };
}

export function parse(input: string): EncodedState {
  return parseVerbose(input).state;
}
