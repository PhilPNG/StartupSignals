import type { RawRecord } from '../types';

/**
 * Accelerators and incubators — no API. Curate data/raw/accelerators.csv by hand from the
 * portfolio pages of NJ accelerators and university incubators.
 * Suggested columns: company, city, program, cohort_date, selective (yes/no), source_url.
 */
export async function loadAccelerators(): Promise<RawRecord[]> {
  // TODO: parse the CSV (source 'accelerator', signalType 'accelerator', count = 1)
  return [];
}
