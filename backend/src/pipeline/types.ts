import type { SignalType } from '../lib/types';

/** One row pulled from a source, before it is matched onto the master company list. */
export interface RawRecord {
  source: string;
  externalId: string;
  name: string;
  city?: string;
  state?: string;
  address?: string;
  /** Unset for identity-only rows. */
  signalType?: SignalType;
  amount?: number;
  count?: number;
  date?: string;
  sourceUrl?: string;
  description?: string;
  subtype?: string;
  industryGroup?: string;
  foundedYear?: number;
  isPublic?: boolean;
  website?: string;
  cik?: string;
  uei?: string;
  raw?: unknown;
}
