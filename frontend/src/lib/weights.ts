import type { Weights } from '../types';

export const PRESETS = {
  default: {
    label: 'Default',
    weights: { funding: 30, grant: 20, hiring: 20, ip: 15, accelerator: 10, support: 5 },
  },
  investor: {
    label: 'Investor view',
    weights: { funding: 40, grant: 10, hiring: 15, ip: 25, accelerator: 7, support: 3 },
  },
  ecosystem: {
    label: 'Ecosystem view',
    weights: { funding: 15, grant: 30, hiring: 30, ip: 10, accelerator: 10, support: 5 },
  },
} satisfies Record<string, { label: string; weights: Weights }>;
