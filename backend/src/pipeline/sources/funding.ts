import type { RawRecord } from '../types';

/**
 * SEC Form D quarterly data sets — free ZIP download, e.g. 2026q1_d.zip.
 * https://www.sec.gov/dera/data/form-d-data-sets
 * Filter the issuers table to state = NJ and drop "Pooled Investment Fund" industry groups.
 * Drop the ZIPs into data/raw/.
 */
export async function fetchFormD(): Promise<RawRecord[]> {
  // TODO: unzip data/raw/*_d.zip, join ISSUERS + OFFERING tables, map to RawRecords
  // (source 'sec-form-d', signalType 'funding', amount = total amount sold).
  return [];
}

/**
 * SEC EDGAR full-text search, for filings newer than the latest quarterly set.
 * GET https://efts.sec.gov/LATEST/search-index?q=…&forms=D&locationCodes=NJ&dateRange=custom&startdt=…&enddt=…
 * /LATEST/ is case-sensitive and a q term is required. Send User-Agent: process.env.SEC_USER_AGENT.
 */
export async function fetchRecentFormD(): Promise<RawRecord[]> {
  // TODO
  return [];
}
