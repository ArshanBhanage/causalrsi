/**
 * Every factual claim rendered by this site lives here.
 *
 * Rules enforced by `tests/content.test.ts`:
 *  - no component or shader may contain a factual string
 *  - a field with no supporting evidence in this repository is `null` and is not rendered
 *  - nothing here may assert a benchmark, deployment, real-LLM, funding or affiliation claim
 */

export interface TeamMember {
  readonly name: string;
  readonly role: string;
  /** The repository file that evidences this entry. */
  readonly evidence: string;
}

export interface SiteLink {
  readonly label: string;
  readonly url: string;
}

export interface SiteContent {
  readonly project: string;
  readonly tagline: string;
  readonly shortDescription: string;
  readonly longDescription: string;
  readonly researchQuestion: string;
  readonly approach: string;
  readonly team: readonly TeamMember[];
  readonly github: string;
  readonly email: string | null;
  readonly institution: string | null;
  readonly status: string;
  readonly links: readonly SiteLink[];
}

export const SITE: SiteContent = {
  project: 'CausalRSI',

  tagline: 'Causal Credit Assignment for Recursive Self-Improving Agents',

  shortDescription:
    'Research into which modification actually caused an improvement when a self-improving agent changes several components at once.',

  longDescription:
    'A self-improving agent rarely changes one thing. It rewrites a prompt, extends a memory, ' +
    'swaps a retriever and re-plans, then scores higher than it did before. Ordinary evaluation ' +
    'reports the difference and stops there. It cannot say whether the gain came from the memory, ' +
    'from the planner, from an interaction between the two, or from a change that merely ' +
    'correlated with the others. CausalRSI treats that gap as a causal credit-assignment problem: ' +
    'define the versioned subsystems as variables, intervene on them, and ask what the outcome ' +
    'would have been had one change not happened. Without that, a self-improvement loop is ' +
    'optimising against noise it cannot see.',

  researchQuestion:
    'When a self-improving agent changes multiple components and then performs better, which modifications actually caused the improvement?',

  approach:
    'Model the agent as versioned subsystems in a directed causal graph, record every change ' +
    'through a typed, hash-chained intervention ledger, and estimate per-subsystem and ' +
    'interaction effects against explicit counterfactuals rather than against a single aggregate ' +
    'score. Validity control and false-commit rate are treated as the floor the work has to ' +
    'clear, not as an afterthought.',

  team: [
    {
      name: 'Arshan Bhanage',
      role: 'Research and engineering',
      evidence: 'github.com/ArshanBhanage',
    },
    {
      name: 'Parth Maradia',
      role: 'Research and engineering',
      evidence: 'pyproject.toml',
    },
    {
      name: 'Mohsen',
      role: 'Research',
      evidence: 'stated by the project owner',
    },
  ],

  github: 'https://github.com/Parth0248/CausalRSI',

  // No author email is recorded anywhere in this repository.
  email: null,

  // No institution is recorded anywhere in this repository.
  institution: null,

  status:
    'Early-stage research scaffold. Current results come from a toy simulation and are negative ' +
    'or unresolved: no tested history-versus-state comparison cleared the predeclared practical ' +
    'margin, and the specialised history mechanism under test was stopped at that scale. ' +
    'Research gates G1 and G2 are open. There is no real-LLM result, no benchmark, no deployment ' +
    'and no recursive-self-improvement claim.',

  links: [
    { label: 'Source', url: 'https://github.com/Parth0248/CausalRSI' },
  ],
} as const;

/** The marker attached to every value that originates in the demo simulation. */
export const ILLUSTRATIVE = 'ILLUSTRATIVE SIMULATION' as const;

/**
 * Copy for the architecture annotations. Kept here because it makes factual claims.
 * Each body is bounded at 200 characters so it can sit beside the geometry it describes.
 */
export const ARCHITECTURE_NOTES: readonly {
  readonly key: string;
  readonly body: string;
  /** Graph node this note is anchored to. */
  readonly anchor: string;
}[] = [
  {
    key: 'SUBSYSTEMS',
    anchor: 'PROMPT',
    body:
      'The unit of analysis is a versioned subsystem, not a whole agent. Prompt, memory, retriever, planner, tools, reasoning, policy, code and evaluator each carry a version.',
  },
  {
    key: 'LEDGER',
    anchor: 'MEMORY',
    body:
      'Changes are recorded in a typed event ledger with a SHA-256 record chain. Tamper-evident against a pinned root hash; not immutable against a rewrite.',
  },
  {
    key: 'ESTIMATION',
    anchor: 'EVALUATOR',
    body:
      'Effects are estimated per subsystem and per interaction against explicit counterfactuals, with the residual carried openly rather than absorbed.',
  },
  {
    key: 'INFRASTRUCTURE',
    anchor: 'REWARD',
    body:
      'The Python package in this repository is research infrastructure and carries no empirical claims. It is dependency-free and guards its own import boundaries.',
  },
];

/** The one supporting statement the narrative is allowed to make in prose. */
export const SUPPORTING_LINE =
  'Evaluation can tell us that an agent improved. We want to understand what caused it.' as const;

export const CLOSING_LINES = [
  'SELF-IMPROVEMENT',
  'WITHOUT',
  'CAUSAL UNDERSTANDING',
  'IS JUST',
  'TRIAL AND ERROR.',
] as const;

export const RESEARCH_FOCUS_LINE =
  'Researching the causal machinery behind self-improving agents.' as const;
