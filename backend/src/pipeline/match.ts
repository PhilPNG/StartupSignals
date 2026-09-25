import { createHash } from 'node:crypto';
import type { Company, Dataset, Signal } from '../lib/types';
import { isExcluded, isNewJersey } from './filter';
import type { RawRecord } from './types';

// NIH R43/R44/U44 rows are small-business awards and can seed the list if
// the SEC/SBIR bulk downloads are temporarily unavailable.
const MASTER_SOURCES = new Set(['sec-form-d', 'sbir', 'nih']);
const SUFFIXES = /\b(inc|incorporated|llc|corp|corporation|co|company|ltd|limited|lp|llp|pc)\b/g;

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(SUFFIXES, ' ').replace(/\s+/g, ' ').trim();
}

export function matchKey(name: string, city = ''): string {
  return `${normalizeName(name)}|${city.toLowerCase().trim()}`;
}

function stableId(key: string): string {
  const bytes = createHash('sha1').update(`startupsignals:${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface MatchedRecord { record: RawRecord; companyId: string }
export interface MatchReview { record: RawRecord; candidateCompanyId: string; reason: string }
export interface BuildResult { dataset: Dataset; matched: MatchedRecord[]; review: MatchReview[] }

export function buildDataset(records: RawRecord[], approvedAliases: Map<string, string> = new Map()): BuildResult {
  const nj = records.filter(isNewJersey);
  const excludedKeys = new Set(nj.filter((r) => isExcluded(r)).map((r) => matchKey(r.name, r.city)));
  const companiesByKey = new Map<string, Company>();
  const strong = new Map<string, Company>();
  const byName = new Map<string, Company[]>();

  for (const r of nj.filter((item) => MASTER_SOURCES.has(item.source))) {
    const key = matchKey(r.name, r.city);
    if (!normalizeName(r.name) || !r.city || excludedKeys.has(key)) continue;
    let company = companiesByKey.get(key);
    if (!company) {
      company = { id: stableId(key), name: r.name, address: r.address ?? '', city: r.city,
        county: '', lat: null, lng: null, website: r.website, foundedYear: r.foundedYear,
        sector: 'Other', industryGroup: r.industryGroup, isSample: false };
      companiesByKey.set(key, company);
      const list = byName.get(normalizeName(r.name)) ?? [];
      list.push(company);
      byName.set(normalizeName(r.name), list);
    } else {
      company.address ||= r.address ?? '';
      company.website ||= r.website;
      company.industryGroup ||= r.industryGroup;
      company.foundedYear ||= r.foundedYear;
    }
    if (r.cik) strong.set(`cik:${r.cik}`, company);
    if (r.uei) strong.set(`uei:${r.uei}`, company);
  }

  const matched: MatchedRecord[] = [];
  const review: MatchReview[] = [];
  const signals: Signal[] = [];
  const grantKeys = new Set<string>();
  for (const r of nj) {
    const key = matchKey(r.name, r.city);
    if (excludedKeys.has(key)) continue;
    const aliasId = approvedAliases.get(key);
    const company = (r.cik && strong.get(`cik:${r.cik}`)) ||
      (r.uei && strong.get(`uei:${r.uei}`)) ||
      (aliasId && [...companiesByKey.values()].find((c) => c.id === aliasId)) ||
      companiesByKey.get(key);
    if (!company) {
      const candidates = byName.get(normalizeName(r.name)) ?? [];
      if (candidates.length === 1) review.push({ record: r, candidateCompanyId: candidates[0].id, reason: 'Same normalized name, different city' });
      continue;
    }
    matched.push({ record: r, companyId: company.id });
    if (!r.signalType || !r.date || !r.sourceUrl) continue;
    if (r.signalType === 'grant') {
      const raw = r.raw && typeof r.raw === 'object' ? r.raw as Record<string, unknown> : {};
      const awardId = String(raw.agency_tracking_number ?? raw.project_num ?? raw.id ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (awardId) {
        const grantKey = `${company.id}:${awardId}`;
        if (grantKeys.has(grantKey)) continue;
        grantKeys.add(grantKey);
      }
    }
    signals.push({ companyId: company.id, type: r.signalType, amount: r.amount, count: r.count,
      date: r.date, source: r.source, sourceUrl: r.sourceUrl, description: r.description,
      externalId: r.externalId, subtype: r.subtype });
  }

  return { dataset: { companies: [...companiesByKey.values()], signals }, matched, review };
}
