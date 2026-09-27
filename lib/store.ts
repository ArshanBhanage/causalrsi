'use client';

import { create } from 'zustand';
import {
  INITIAL_MODEL,
  applyIntervention as applyToModel,
  availableVersion,
  reset as resetModel,
  type ComponentId,
  type Intervention,
  type ObservatoryModel,
} from './causalSimulation';
import {
  IDLE_INTERACTION,
  observatoryState,
  type InteractionState,
  type NarrativePhase,
  type ObservatoryState,
} from './choreography';
import { LENS_RADIUS_PX } from './motion';
import { QUALITY, type QualityMode, type QualityProfile } from './performance';

export type LensMode = 'EXPLORE' | 'TRACE' | 'INTERVENE' | 'COMPARE' | 'REWIND';

export interface LensTarget {
  readonly kind: 'node' | 'edge' | 'branch' | 'none';
  readonly id: string | null;
}

export type PropagationStage = 'idle' | 'running' | 'settled';

export interface ObservatoryStore {
  /** normalised scroll progress, quantised to 3dp */
  p: number;
  model: ObservatoryModel;
  interaction: InteractionState;
  derived: ObservatoryState;

  lens: {
    x: number;
    y: number;
    mode: LensMode;
    target: LensTarget;
    radius: number;
    visible: boolean;
  };

  openingComplete: boolean;
  quality: QualityMode;
  reducedMotion: boolean;
  webgl: boolean;
  soundOn: boolean;
  helpOpen: boolean;
  architectureOpen: boolean;

  propagation: { stage: PropagationStage; hop: number; total: number };
  tracedPath: readonly string[];
  announcement: string;

  setProgress: (p: number) => void;
  setLens: (patch: Partial<ObservatoryStore['lens']>) => void;
  setTracedPath: (path: readonly string[]) => void;
  select: (id: ComponentId | null) => void;
  intervene: (component: ComponentId) => void;
  resetIntervention: () => void;
  setCounterfactual: (id: ComponentId | null) => void;
  setPropagation: (patch: Partial<ObservatoryStore['propagation']>) => void;
  completeOpening: () => void;
  setQuality: (mode: QualityMode) => void;
  degrade: () => void;
  setReducedMotion: (value: boolean) => void;
  setWebgl: (value: boolean) => void;
  toggleSound: () => void;
  toggleHelp: () => void;
  setArchitecture: (open: boolean) => void;
  announce: (text: string) => void;
  hydrate: (patch: {
    p?: number;
    selected?: ComponentId | null;
    intervention?: Intervention | null;
  }) => void;
}

const recompute = (p: number, interaction: InteractionState): ObservatoryState =>
  observatoryState(p, interaction);

export const useObservatory = create<ObservatoryStore>((set, get) => ({
  p: 0,
  model: INITIAL_MODEL,
  interaction: IDLE_INTERACTION,
  derived: recompute(0, IDLE_INTERACTION),

  lens: {
    x: 0.5,
    y: 0.5,
    mode: 'EXPLORE',
    target: { kind: 'none', id: null },
    radius: LENS_RADIUS_PX,
    visible: false,
  },

  openingComplete: false,
  quality: 'FULL',
  reducedMotion: false,
  webgl: true,
  soundOn: false,
  helpOpen: false,
  architectureOpen: false,

  propagation: { stage: 'idle', hop: 0, total: 0 },
  tracedPath: [],
  announcement: '',

  setProgress: (p) =>
    set((s) => {
      const derived = recompute(p, s.interaction);
      return { p: derived.p, derived };
    }),

  setLens: (patch) => set((s) => ({ lens: { ...s.lens, ...patch } })),

  setTracedPath: (path) => set({ tracedPath: path }),

  select: (id) =>
    set((s) => {
      const interaction = { ...s.interaction, selected: id };
      return { interaction, derived: recompute(s.p, interaction) };
    }),

  intervene: (component) => {
    const s = get();
    const version = availableVersion(s.model, component);
    if (version === null) return;
    const result = applyToModel(s.model, { component, version });
    if (!result.ok) return;
    const interaction: InteractionState = {
      ...s.interaction,
      selected: component,
      intervention: { component, version },
    };
    set({
      model: result.value,
      interaction,
      derived: recompute(s.p, interaction),
      propagation: { stage: 'running', hop: 0, total: 0 },
      announcement: `Intervention applied: do(${component} = ${version})`,
    });
  },

  resetIntervention: () =>
    set((s) => {
      const interaction: InteractionState = {
        ...s.interaction,
        selected: null,
        intervention: null,
        counterfactualOf: null,
      };
      return {
        model: resetModel(s.model),
        interaction,
        derived: recompute(s.p, interaction),
        propagation: { stage: 'idle', hop: 0, total: 0 },
        announcement: 'Intervention reset',
      };
    }),

  setCounterfactual: (id) =>
    set((s) => {
      const interaction = { ...s.interaction, counterfactualOf: id };
      return { interaction, derived: recompute(s.p, interaction) };
    }),

  setPropagation: (patch) => set((s) => ({ propagation: { ...s.propagation, ...patch } })),

  completeOpening: () => set({ openingComplete: true }),

  setQuality: (mode) => set({ quality: mode }),

  degrade: () =>
    set((s) => ({
      quality: s.quality === 'FULL' ? 'REDUCED' : 'MINIMAL',
    })),

  setReducedMotion: (value) =>
    set((s) => {
      const interaction = { ...s.interaction, reducedMotion: value };
      return { reducedMotion: value, interaction, derived: recompute(s.p, interaction) };
    }),

  setWebgl: (value) => set({ webgl: value }),

  toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),

  toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen })),

  setArchitecture: (open) => set({ architectureOpen: open }),

  announce: (text) => set({ announcement: text }),

  hydrate: (patch) =>
    set((s) => {
      const interaction: InteractionState = {
        ...s.interaction,
        selected: patch.selected ?? s.interaction.selected,
        intervention: patch.intervention ?? s.interaction.intervention,
      };
      let model = s.model;
      if (patch.intervention) {
        const applied = applyToModel(INITIAL_MODEL, patch.intervention);
        if (applied.ok) model = applied.value;
      }
      const p = patch.p ?? s.p;
      return { p, model, interaction, derived: recompute(p, interaction) };
    }),
}));

export function qualityProfile(mode: QualityMode): QualityProfile {
  return QUALITY[mode];
}

export const selectPhase = (s: ObservatoryStore): NarrativePhase => s.derived.phase;
