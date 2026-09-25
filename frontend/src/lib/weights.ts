import type { Weights } from '../types';

export const PRESETS = {
  default: {
    label: 'Default',
    weights: { funding: 30, grant: 25, hiring: 20, ip: 15, accelerator: 10 },
  },
  investor: {
    label: 'Investor view',
    weights: { funding: 40, grant: 13, hiring: 15, ip: 25, accelerator: 7 },
  },
  ecosystem: {
    label: 'Ecosystem view',
    weights: { funding: 15, grant: 35, hiring: 30, ip: 10, accelerator: 10 },
  },
} satisfies Record<string, { label: string; weights: Weights }>;
