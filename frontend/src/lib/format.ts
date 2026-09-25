export function formatUsd(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

/** Date-only strings ("2026-03-10") are read as local dates so they don't shift a day in US time zones. */
export function formatDate(iso: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export type ScoreTier = 'high' | 'mid' | 'low';

export function scoreTier(score: number): ScoreTier {
  if (score >= 50) return 'high';
  if (score >= 25) return 'mid';
  return 'low';
}
