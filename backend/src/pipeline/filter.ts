import type { RawRecord } from './types';

const MAX_AGE_YEARS = 10;
const MAX_RAISE_USD = 100_000_000;

export function isNewJersey(record: RawRecord): boolean {
  return record.state?.toUpperCase() === 'NJ';
}

/** Exclusions from the MVP: pooled investment funds, public companies, over 10 years old, raises over $100M. */
export function isExcluded(record: RawRecord, now = new Date()): boolean {
  if (record.industryGroup?.toLowerCase().includes('pooled investment fund')) return true;
  if (record.isPublic) return true;
  if (record.foundedYear && now.getFullYear() - record.foundedYear > MAX_AGE_YEARS) return true;
  if (record.signalType === 'funding' && (record.amount ?? 0) > MAX_RAISE_USD) return true;
  return false;
}
