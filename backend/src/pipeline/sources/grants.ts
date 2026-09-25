import type { RawRecord } from '../types';

/**
 * SBIR/STTR awards — bulk award + company files from https://www.sbir.gov/data-resources.
 * The SBIR API (https://api.www.sbir.gov/public/api/firm) is often down, so use the bulk files.
 * Filter state = NJ. Keep the phase: Phase II counts double Phase I.
 */
export async function fetchSbirAwards(): Promise<RawRecord[]> {
  // TODO: read data/raw/sbir awards file (source 'sbir', signalType 'grant')
  return [];
}

/**
 * NIH RePORTER — free, no key.
 * POST https://api.reporter.nih.gov/v2/projects/search
 * body {"criteria":{"org_states":["NJ"],"fiscal_years":[2025,2026]},"limit":500}
 * The state code must be uppercase; a wrong one silently returns zero results.
 */
export async function fetchNihGrants(): Promise<RawRecord[]> {
  // TODO
  return [];
}

/**
 * NSF Awards API — free, no key.
 * GET https://api.nsf.gov/services/v1/awards.json?awardeeStateCode=NJ&printFields=id,title,awardeeName,awardeeCity,fundsObligatedAmt,startDate,ueiNumber
 */
export async function fetchNsfGrants(): Promise<RawRecord[]> {
  // TODO
  return [];
}

/**
 * NJEDA — no API. Startup program approvals are copied by hand from board meeting materials
 * into data/raw/njeda.csv (source 'njeda', signalType 'support').
 */
export async function loadNjedaAwards(): Promise<RawRecord[]> {
  // TODO: parse data/raw/njeda.csv
  return [];
}
