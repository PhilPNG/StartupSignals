import type { RawRecord } from '../types';

/**
 * USPTO Open Data Portal (formerly PatentsView) — key in the X-API-Key header (USPTO_API_KEY).
 * Getting the key needs ID.me verification, so start early. Filter assignee/applicant state = NJ,
 * recent filings only. Fallback: Google Patents on BigQuery, or clearly labeled sample IP data.
 */
export async function fetchPatentsAndTrademarks(): Promise<RawRecord[]> {
  // TODO (source 'uspto', signalType 'ip', count = filings)
  return [];
}
