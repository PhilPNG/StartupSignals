import type { ScoredCompany, SignalType } from '../types';

export interface FilterState {
  sector: string;
  county: string;
  minScore: number;
  /** Only show companies that have every one of these signals. */
  hasSignals: SignalType[];
}

export const EMPTY_FILTERS: FilterState = { sector: '', county: '', minScore: 0, hasSignals: [] };

export function applyFilters(companies: ScoredCompany[], f: FilterState): ScoredCompany[] {
  return companies.filter(
    (c) =>
      (!f.sector || c.sector === f.sector) &&
      (!f.county || c.county === f.county) &&
      c.score >= f.minScore &&
      f.hasSignals.every((t) => c.signalScores[t] > 0),
  );
}
