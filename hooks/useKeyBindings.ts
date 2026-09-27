'use client';

import { useEffect } from 'react';
import { MUTABLE_IDS } from '@/lib/causalSimulation';
import { PHASES, progressForPhase } from '@/lib/choreography';
import { useObservatory } from '@/lib/store';
import { scrollToProgress } from './useScrollProgress';

/** Keyboard access to every state the pointer can reach. */
export function useKeyBindings(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const s = useObservatory.getState();
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      switch (event.key) {
        case 'ArrowDown':
        case 'PageDown': {
          event.preventDefault();
          const next = Math.min(s.derived.phaseIndex, PHASES.length - 1);
          scrollToProgress(progressForPhase(PHASES[next] ?? PHASES[0]));
          break;
        }
        case 'ArrowUp':
        case 'PageUp': {
          event.preventDefault();
          const prev = Math.max(s.derived.phaseIndex - 2, 0);
          scrollToProgress(progressForPhase(PHASES[prev] ?? PHASES[0]));
          break;
        }
        case 'c':
        case 'C': {
          if (event.repeat) return;
          const candidate = s.interaction.selected ?? MUTABLE_IDS[1];
          if (candidate) s.setCounterfactual(candidate);
          break;
        }
        case 'r':
        case 'R':
          s.resetIntervention();
          break;
        case 's':
        case 'S':
          s.toggleSound();
          break;
        case '?':
          s.toggleHelp();
          break;
        case 'Escape':
          if (s.helpOpen) s.toggleHelp();
          else s.select(null);
          break;
        default: {
          const digit = Number.parseInt(event.key, 10);
          if (!Number.isNaN(digit) && digit >= 1 && digit <= 7) {
            scrollToProgress(progressForPhase(PHASES[digit - 1] ?? PHASES[0]));
          }
        }
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'c' || event.key === 'C') {
        useObservatory.getState().setCounterfactual(null);
      }
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);
}
