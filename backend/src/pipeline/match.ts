import type { Company, Dataset, Signal } from '../lib/types';
import type { RawRecord } from './types';

/** Sources that define the master company list; every other source is matched onto it. */
const MASTER_SOURCES = new Set(['sec-form-d', 'sbir']);

const SUFFIXES = /\b(inc|incorporated|llc|corp|corporation|co|company|ltd|limited|lp|llp|pc)\b/g;

/** Lowercase, strip punctuation and legal suffixes (Inc, LLC, Corp, ...). */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(SUFFIXES, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchKey(name: string, city = ''): string {
  return `${normalizeName(name)}|${city.toLowerCase().trim()}`;
}

/** Builds the master list from Form D + SBIR rows, then attaches every signal by name + city. */
export function buildDataset(records: RawRecord[]): Dataset {
  const companies = new Map<string, Company>();

  for (const r of records.filter((r) => MASTER_SOURCES.has(r.source))) {
    const key = matchKey(r.name, r.city);
    if (companies.has(key)) continue;
    companies.set(key, {
      id: key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      name: r.name,
      address: r.address ?? '',
      city: r.city ?? '',
      county: '', // TODO: city → county lookup
      lat: 0,
      lng: 0,
      foundedYear: r.foundedYear,
      sector: 'Other',
      industryGroup: r.industryGroup,
      isSample: false,
    });
  }

  // TODO: fuzzy fallback for near-miss names; exact name + city will miss some matches.
  const signals: Signal[] = [];
  for (const r of records) {
    const company = companies.get(matchKey(r.name, r.city));
    if (!company || !r.signalType || !r.date) continue;
    signals.push({
      companyId: company.id,
      type: r.signalType,
      amount: r.amount,
      count: r.count,
      date: r.date,
      source: r.source,
      sourceUrl: r.sourceUrl ?? '',
      description: r.description,
    });
  }

  return { companies: [...companies.values()], signals };
}
