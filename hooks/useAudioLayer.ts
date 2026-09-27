'use client';

import { useEffect, useRef } from 'react';
import { useObservatory } from '@/lib/store';

type EventKind = 'node' | 'propagate' | 'intervene' | 'split' | 'counterfactual';

const TONES: Readonly<Record<EventKind, readonly [number, number, number]>> = {
  node: [880, 0.06, 0.09],
  propagate: [523.25, 0.05, 0.14],
  intervene: [1174.66, 0.07, 0.18],
  split: [392, 0.05, 0.22],
  counterfactual: [261.63, 0.06, 0.34],
};

/**
 * Optional interface sound. Off on every load, context created only after a user gesture, one
 * short envelope per causal event, no continuous bed.
 */
export function useAudioLayer(): void {
  const soundOn = useObservatory((s) => s.soundOn);
  const intervention = useObservatory((s) => s.interaction.intervention);
  const counterfactualOf = useObservatory((s) => s.interaction.counterfactualOf);
  const phase = useObservatory((s) => s.derived.phase);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!soundOn) {
      void ctxRef.current?.suspend();
      return;
    }
    if (ctxRef.current === null) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctxRef.current = new Ctor();
    }
    void ctxRef.current.resume();
  }, [soundOn]);

  useEffect(() => {
    const onHidden = () => {
      if (document.hidden) void ctxRef.current?.suspend();
      else if (useObservatory.getState().soundOn) void ctxRef.current?.resume();
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  }, []);

  const play = (kind: EventKind) => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== 'running') return;
    const [freq, gain, duration] = TONES[kind];
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0, ctx.currentTime);
    env.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(env).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + Math.min(duration, 0.4));
  };

  useEffect(() => {
    if (intervention) play('intervene');
  }, [intervention]);

  useEffect(() => {
    if (counterfactualOf) play('counterfactual');
  }, [counterfactualOf]);

  useEffect(() => {
    if (phase === 'MODIFICATIONS') play('split');
    else if (phase === 'CREDIT_ASSIGNMENT') play('propagate');
  }, [phase]);
}
