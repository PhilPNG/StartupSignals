import type { RawRecord } from '../types';
import { MissingInputError } from '../source-utils';

/**
 * USPTO Open Data Portal (formerly PatentsView) — key in the X-API-Key header (USPTO_API_KEY).
 * Getting the key needs ID.me verification, so start early. Filter assignee/applicant state = NJ,
 * recent filings only. Fallback: Google Patents on BigQuery, or clearly labeled sample IP data.
 */
export async function fetchPatentsAndTrademarks(): Promise<RawRecord[]> {
  throw new MissingInputError('USPTO adapter needs a verified dataset and organization match before scoring');
}
