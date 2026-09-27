import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  INITIAL_ENCODED_STATE,
  MAX_FRAGMENT_LENGTH,
  format,
  parse,
  parseVerbose,
  type EncodedState,
} from '@/lib/stateCodec';
import { PHASES } from '@/lib/choreography';
import { COMPONENT_IDS, MUTABLE_IDS, type ComponentId } from '@/lib/causalSimulation';

const RUNS = { numRuns: 200 };

const stateArb: fc.Arbitrary<EncodedState> = fc.record({
  p: fc.integer({ min: 0, max: 1000 }).map((n) => n / 1000),
  phase: fc.constantFrom(...PHASES),
  selected: fc.option(fc.constantFrom(...(COMPONENT_IDS as ComponentId[])), { nil: null }),
  intervention: fc.option(
    fc.record({
      component: fc.constantFrom(...(MUTABLE_IDS as ComponentId[])),
      version: fc.integer({ min: 1, max: 99 }).map((n) => `v${String(n).padStart(2, '0')}`),
    }),
    { nil: null },
  ),
});

/** Property 13: codec round trip. */
describe('Property 13: codec round trip', () => {
  it('parse(format(state)) equals state', () => {
    fc.assert(
      fc.property(stateArb, (state) => {
        const back = parse(format(state));
        expect(back.phase).toBe(state.phase);
        expect(back.selected).toBe(state.selected);
        expect(back.intervention).toEqual(state.intervention);
        expect(Math.abs(back.p - state.p)).toBeLessThanOrEqual(1e-9);
      }),
      RUNS,
    );
  });
});

/** Property 14: canonical printing round trip. */
describe('Property 14: canonical printing round trip', () => {
  it('format(parse(text)) equals text for canonical text', () => {
    fc.assert(
      fc.property(stateArb, (state) => {
        const text = format(state);
        expect(format(parse(text))).toBe(text);
      }),
      RUNS,
    );
  });
});

/** Property 15: malformed fragment totality. */
describe('Property 15: malformed fragment totality', () => {
  it('any string of bounded length parses to exactly one state without throwing', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 300 }), (text) => {
        const outcome = parseVerbose(text);
        expect(PHASES).toContain(outcome.state.phase);
        expect(outcome.state.p).toBeGreaterThanOrEqual(0);
        expect(outcome.state.p).toBeLessThanOrEqual(1);
      }),
      RUNS,
    );
  });

  it('falls back to the initial state on malformed input', () => {
    for (const bad of [
      'p=2.0&ph=AGENT_N&n=-&iv=-',
      'p=0.5&ph=NOPE&n=-&iv=-',
      'p=0.5&ph=AGENT_N&n=GHOST&iv=-',
      'p=0.5&ph=AGENT_N&n=-&iv=MEMORY',
      'p=0.5&ph=AGENT_N&n=-',
      'p=0.5&ph=AGENT_N&n=-&iv=-&extra=1',
      'p=&ph=AGENT_N&n=-&iv=-',
      'garbage',
    ]) {
      const outcome = parseVerbose(bad);
      expect(outcome.rejected).not.toBeNull();
      expect(outcome.state).toEqual(INITIAL_ENCODED_STATE);
    }
  });

  it('rejects an over-long fragment', () => {
    const outcome = parseVerbose('x'.repeat(MAX_FRAGMENT_LENGTH + 1));
    expect(outcome.rejected).toBe('length');
  });

  it('accepts an empty fragment silently', () => {
    const outcome = parseVerbose('');
    expect(outcome.rejected).toBeNull();
    expect(outcome.state).toEqual(INITIAL_ENCODED_STATE);
  });

  it('tolerates a leading hash', () => {
    const text = format({ ...INITIAL_ENCODED_STATE, p: 0.662, phase: 'COUNTERFACTUALS' });
    expect(parse(`#${text}`).phase).toBe('COUNTERFACTUALS');
  });

  it('formats the documented example', () => {
    expect(
      format({
        p: 0.662,
        phase: 'COUNTERFACTUALS',
        selected: 'MEMORY',
        intervention: { component: 'MEMORY', version: 'v04' },
      }),
    ).toBe('p=0.662&ph=COUNTERFACTUALS&n=MEMORY&iv=MEMORY:v04');
  });
});
