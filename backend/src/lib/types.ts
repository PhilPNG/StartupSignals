// Mirrored in frontend/src/types.ts — keep the two in sync.

export type SignalType = 'funding' | 'grant' | 'hiring' | 'ip' | 'accelerator';

export const SIGNAL_TYPES: SignalType[] = ['funding', 'grant', 'hiring', 'ip', 'accelerator'];

/** Relative weight per signal; normalized to sum to 1 before scoring. */
export type Weights = Record<SignalType, number>;

/** 0–100 value per signal type. */
export type SignalScores = Record<SignalType, number>;

/** One source record (a Form D filing, a grant, a job snapshot, ...) attached to a company. */
export interface Signal {
  companyId: string;
  type: SignalType;
  externalId?: string;
  subtype?: string;
  amount?: number;
  count?: number;
  date: string;
  source: string;
  sourceUrl: string;
  description?: string;
}

export interface Company {
  id: string;
  name: string;
  address: string;
  city: string;
  county: string;
  lat: number | null;
  lng: number | null;
  geocodeConfidence?: string;
  website?: string;
  foundedYear?: number;
  sector: string;
  industryGroup?: string;
  /** True for hand-made demo rows, so the UI can label them. */
  isSample: boolean;
}

export interface ScoredCompany extends Company {
  /** Percentile rank (0–100) within the NJ set, per signal. */
  signalScores: SignalScores;
  /** Points each signal adds to the total; sums to `score`. */
  contributions: SignalScores;
  signalTypes: number;
  score: number;
  rank: number;
}

/** LLM summary of a company's public signals, generated offline by `npm run enrich`. */
export interface CompanyAiEnrichment {
  summary: string;
  momentumSummary: string;
  keySignals: string[];
  /** Source keys of the records the summary was written from (e.g. `sbir`, `sec-form-d`). */
  evidenceSources: string[];
  generatedAt: string;
}

export interface CompanyDetail extends ScoredCompany {
  signals: Signal[];
  /** Null until the enrichment job has summarized this company. */
  ai: CompanyAiEnrichment | null;
}

export interface Sector {
  sector: string;
  companies: number;
  depth: number;
  breadth: number;
  growth: number;
  sectorScore: number;
}

export interface Dataset {
  companies: Company[];
  signals: Signal[];
}
