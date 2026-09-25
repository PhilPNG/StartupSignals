import {
  Building2,
  Coins,
  Cpu,
  CreditCard,
  Dna,
  Factory,
  Gift,
  Leaf,
  Lightbulb,
  Rocket,
  Stethoscope,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { SignalType } from '../types';

export const SIGNAL_ICONS: Record<SignalType, LucideIcon> = {
  funding: Coins,
  grant: Gift,
  hiring: Users,
  ip: Lightbulb,
  accelerator: Rocket,
};

const SECTOR_ICONS: Record<string, LucideIcon> = {
  Biotech: Dna,
  Fintech: CreditCard,
  'AI & Software': Cpu,
  'Climate & Energy': Leaf,
  Medtech: Stethoscope,
  'Advanced Manufacturing': Factory,
};

export function sectorIcon(sector: string): LucideIcon {
  return SECTOR_ICONS[sector] ?? Building2;
}
