import type { SignalType } from '../types';

// Sector names come from backend/src/pipeline/cluster.ts.
const SECTOR_COLORS: Record<string, string> = {
  Biotech: '#16a34a',
  Medtech: '#0891b2',
  'Climate & Energy': '#ca8a04',
  Fintech: '#2563eb',
  'AI & Software': '#9333ea',
  'Advanced Manufacturing': '#ea580c',
};

export function sectorColor(sector: string): string {
  return SECTOR_COLORS[sector] ?? '#64748b';
}

export const SIGNAL_COLORS: Record<SignalType, string> = {
  funding: '#2563eb',
  grant: '#16a34a',
  hiring: '#ea580c',
  ip: '#9333ea',
  accelerator: '#db2777',
  support: '#64748b',
};
