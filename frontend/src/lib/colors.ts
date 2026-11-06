import type { SignalType } from '../types';

interface SectorPalette {
  /** Pins, dots and bars. */
  color: string;
  /** Solid chips with white text; dark enough for AA contrast. */
  deep: string;
}

// Sector names come from backend/src/pipeline/cluster.ts.
const SECTOR_PALETTE: Record<string, SectorPalette> = {
  Biotech: { color: '#8b5cf6', deep: '#6d3fd6' },
  Fintech: { color: '#16a39a', deep: '#0c7c75' },
  'AI & Software': { color: '#3b82f6', deep: '#2563eb' },
  'Climate & Energy': { color: '#34b96a', deep: '#1f7f47' },
  Medtech: { color: '#ef5b5b', deep: '#c53030' },
  'Advanced Manufacturing': { color: '#f59e0b', deep: '#b45309' },
};

const OTHER: SectorPalette = { color: '#94a3b8', deep: '#475569' };

export function sectorColor(sector: string): string {
  return (SECTOR_PALETTE[sector] ?? OTHER).color;
}

export function sectorDeep(sector: string): string {
  return (SECTOR_PALETTE[sector] ?? OTHER).deep;
}

export const SIGNAL_COLORS: Record<SignalType, string> = {
  funding: '#34b96a',
  grant: '#e8a23a',
  hiring: '#3b82f6',
  ip: '#8b5cf6',
  accelerator: '#ec6a8c',
};
