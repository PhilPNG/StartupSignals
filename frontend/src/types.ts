// Mirrors backend/src/lib/types.ts — keep the two in sync.

export type SignalType = 'funding' | 'grant' | 'hiring' | 'ip' | 'accelerator' | 'support';

export const SIGNAL_TYPES: SignalType[] = ['funding', 'grant', 'hiring', 'ip', 'accelerator', 'support'];

export const SIGNAL_LABELS: Record<SignalType, string> = {
  funding: 'Funding',
  grant: 'Grants',
  hiring: 'Hiring',
  ip: 'IP',
  accelerator: 'Accelerator',
  support: 'Public support',
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
  lat: number;
  lng: number;
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

export interface CompanyDetail extends ScoredCompany {
  signals: Signal[];
}

export interface Sector {
  sector: string;
  companies: number;
  depth: number;
  breadth: number;
  growth: number;
  sectorScore: number;
}
