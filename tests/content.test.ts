import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ARCHITECTURE_NOTES, ILLUSTRATIVE, SITE } from '@/content/site';

const ROOT = join(__dirname, '..');

const EXPECTED_KEYS = [
  'project',
  'tagline',
  'shortDescription',
  'longDescription',
  'researchQuestion',
  'approach',
  'team',
  'github',
  'email',
  'institution',
  'status',
  'links',
] as const;

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out = out.concat(walk(full));
    } else if (/\.(ts|tsx|glsl)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('content module shape', () => {
  it('exports exactly the twelve required keys', () => {
    expect(Object.keys(SITE).sort()).toEqual([...EXPECTED_KEYS].sort());
  });

  it('pins the project name and tagline', () => {
    expect(SITE.project).toBe('CausalRSI');
    expect(SITE.tagline).toBe('Causal Credit Assignment for Recursive Self-Improving Agents');
  });

  it('pins the repository', () => {
    expect(SITE.github).toBe('https://github.com/Parth0248/CausalRSI');
  });

  it('records one evidenced team entry', () => {
    expect(SITE.team).toHaveLength(1);
    expect(SITE.team[0]?.name).toBe('Parth Maradia');
    expect(SITE.team[0]?.evidence).toBe('pyproject.toml');
  });

  it('nulls the fields this repository does not evidence', () => {
    expect(SITE.email).toBeNull();
    expect(SITE.institution).toBeNull();
  });

  it('respects the length bounds', () => {
    const bounds: Record<string, readonly [number, number]> = {
      project: [1, 60],
      tagline: [1, 120],
      shortDescription: [1, 200],
      longDescription: [1, 1200],
      researchQuestion: [1, 200],
      approach: [1, 600],
      status: [120, 600],
    };
    for (const [key, [lo, hi]] of Object.entries(bounds)) {
      const value = (SITE as unknown as Record<string, string>)[key];
      expect(typeof value).toBe('string');
      expect(value.trim().length).toBeGreaterThanOrEqual(lo);
      expect(value.length).toBeLessThanOrEqual(hi);
    }
  });

  it('bounds the collections', () => {
    expect(SITE.team.length).toBeLessThanOrEqual(8);
    expect(SITE.links.length).toBeLessThanOrEqual(12);
    for (const link of SITE.links) {
      expect(link.label.length).toBeGreaterThanOrEqual(1);
      expect(link.label.length).toBeLessThanOrEqual(40);
      expect(link.url.startsWith('https://')).toBe(true);
    }
  });

  it('states the open gates and the honest status', () => {
    expect(SITE.status).toMatch(/G1 and G2 are open/);
    expect(SITE.status).toMatch(/negative\s+or unresolved|negative or unresolved/);
  });

  it('describes the Python package as research infrastructure without empirical claims', () => {
    const infra = ARCHITECTURE_NOTES.find((n) => n.key === 'INFRASTRUCTURE');
    expect(infra?.body).toMatch(/no empirical\s+claims|no empirical claims/);
  });

  it('exposes the illustrative marker', () => {
    expect(ILLUSTRATIVE).toBe('ILLUSTRATIVE SIMULATION');
  });
});

describe('prohibited assertions', () => {
  const haystack = [
    SITE.shortDescription,
    SITE.longDescription,
    SITE.researchQuestion,
    SITE.approach,
    SITE.status,
    ...ARCHITECTURE_NOTES.map((n) => n.body),
  ]
    .join(' ')
    .toLowerCase();

  const banned = [
    'revolutioniz',
    'unlock the future',
    'ai-powered innovation',
    'trusted by',
    'state of the art',
    'world-class',
    'customers',
    'revenue',
    'funding',
    'investor',
    'partnership',
    'google',
    'nvidia',
    'openai',
    'benchmark result',
    'peer-reviewed',
    'gates passed',
  ];

  it.each(banned)('never claims "%s"', (phrase) => {
    expect(haystack).not.toContain(phrase);
  });
});

describe('factual strings stay out of components and shaders', () => {
  const files = [join(ROOT, 'components'), join(ROOT, 'shaders')]
    .flatMap((dir) => {
      try {
        return walk(dir);
      } catch {
        return [];
      }
    })
    .map((path) => ({ path, text: readFileSync(path, 'utf8') }));

  const forbidden = [
    SITE.project,
    SITE.tagline,
    SITE.github,
    'Parth',
    'Maradia',
    'github.com',
  ];

  it.each(forbidden)('no component or shader contains "%s"', (needle) => {
    const offenders = files.filter((f) => f.text.includes(needle)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('no component or shader contains an email address', () => {
    const offenders = files
      .filter((f) => /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});
