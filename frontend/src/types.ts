// Mirrors backend/src/lib/types.ts — keep the two in sync.

export type SignalType = 'funding' | 'grant' | 'hiring' | 'ip' | 'accelerator';

export const SIGNAL_TYPES: SignalType[] = ['funding', 'grant', 'hiring', 'ip', 'accelerator'];

export const SIGNAL_LABELS: Record<SignalType, string> = {
  funding: 'Funding',
  grant: 'Grants',
  hiring: 'Hiring',
  ip: 'IP',
  accelerator: 'Accelerator',
};

export type Weights = Record<SignalType, number>;

export type SignalScores = Record<SignalType, number>;

export interface Signal {
  companyId: string;
  type: SignalType;
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
  website?: string;
  foundedYear?: number;
  sector: string;
  industryGroup?: string;
  isSample: boolean;
}

export interface ScoredCompany extends Company {
  signalScores: SignalScores;
  contributions: SignalScores;
  signalTypes: number;
  score: number;
  rank: number;
}

export interface CompanyAiEnrichment {
  summary: string;
  momentumSummary: string;
  keySignals: string[];
  evidenceSources: string[];
  generatedAt: string;
}

export interface CompanyDetail extends ScoredCompany {
  signals: Signal[];
  ai: CompanyAiEnrichment | null;
}

/** `live` is the published Supabase set; `sample` is the labeled demo file. */
export type DatasetName = 'live' | 'sample';

export interface SourceRun {
  source: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  rows_accepted: number | null;
}

/** Shape of GET /api/health (frontend-only; not mirrored in the backend types). */
export interface Health {
  ok: boolean;
  mode?: 'real' | 'sample';
  companies?: number;
  activeSignalTypes?: SignalType[];
  sources?: SourceRun[];
}

export interface Sector {
  sector: string;
  companies: number;
  depth: number;
  breadth: number;
  growth: number;
  sectorScore: number;
}
