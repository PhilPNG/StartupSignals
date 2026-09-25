import { database } from '../../lib/supabase';
import { normalizeName } from '../match';
import { isoDate, MissingInputError } from '../source-utils';
import type { RawRecord } from '../types';

const SEARCH_URL = 'https://api.uspto.gov/api/v1/patent/applications/search';
const FIELDS = [
  'applicationNumberText', 'applicationMetaData.applicationTypeCode',
  'applicationMetaData.applicantBag', 'applicationMetaData.filingDate',
  'applicationMetaData.earliestPublicationDate', 'applicationMetaData.grantDate',
  'applicationMetaData.patentNumber', 'applicationMetaData.inventionTitle',
].join(',');
const PAGE_SIZE = 100;
const MAX_RESULTS_PER_NAME = 500;
const MIN_INTERVAL_MS = 1100;

interface Address { cityName?: string; geographicRegionCode?: string }
interface Applicant { applicantNameText?: string; correspondenceAddressBag?: Address[] }
interface PatentApplication {
  applicationNumberText?: string;
  applicationMetaData?: {
    applicationTypeCode?: string;
    applicantBag?: Applicant[];
    filingDate?: string;
    earliestPublicationDate?: string;
    grantDate?: string;
    patentNumber?: string;
    inventionTitle?: string;
  };
}
interface SearchResponse { count?: number; patentFileWrapperDataBag?: PatentApplication[] }
interface CompanyRow { name: string; city: string }

let lastRequestAt = 0;
async function searchPage(key: string, name: string, offset: number): Promise<SearchResponse> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set('q', `applicationMetaData.applicantBag.applicantNameText:"${name.replace(/["\\]/g, ' ')}"`);
  url.searchParams.set('limit', String(PAGE_SIZE));
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('fields', FIELDS);

  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastRequestAt));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    try {
      const response = await fetch(url, {
        headers: { 'X-API-KEY': key }, signal: AbortSignal.timeout(25_000),
      });
      if (response.status === 404) return { count: 0, patentFileWrapperDataBag: [] };
      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        const retryAfter = Number(response.headers.get('retry-after'));
        await new Promise((resolve) => setTimeout(resolve,
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt));
        continue;
      }
      if (!response.ok) throw new Error(`USPTO search HTTP ${response.status}: ${(await response.text()).slice(0, 160)}`);
      const body = await response.json() as SearchResponse;
      if (!Number.isInteger(body.count) || !Array.isArray(body.patentFileWrapperDataBag)) {
        throw new Error('USPTO search response is missing its count or applications');
      }
      return body;
    } catch (error) {
      if (attempt === 3 || (error instanceof Error && error.message.startsWith('USPTO search HTTP'))) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000 * 2 ** attempt));
    }
  }
  throw new Error('USPTO search retries exhausted');
}

async function activeCompanies(): Promise<CompanyRow[]> {
  const db = database();
  const companies: CompanyRow[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await db.from('companies').select('name,city')
      .eq('active', true).eq('is_sample', false).order('id').range(start, start + 999);
    if (error) throw new Error(`USPTO company list: ${error.message}`);
    companies.push(...(data ?? []) as CompanyRow[]);
    if ((data ?? []).length < 1000) return companies;
  }
}

function patentRecord(application: PatentApplication, known: Set<string>, cutoff: string): RawRecord | undefined {
  const number = application.applicationNumberText?.replace(/[^A-Za-z0-9]/g, '') ?? '';
  const meta = application.applicationMetaData;
  // Exclude provisional and PCT filings that can duplicate a US utility application.
  if (!/^\d{8}$/.test(number) || meta?.applicationTypeCode !== 'UTL') return;
  let matched: { applicant: Applicant; address: Address } | undefined;
  for (const applicant of meta.applicantBag ?? []) {
    const name = normalizeName(applicant.applicantNameText ?? '');
    const address = applicant.correspondenceAddressBag?.find((item) =>
      item.geographicRegionCode?.toUpperCase() === 'NJ' &&
      known.has(`${name}|${item.cityName?.toLowerCase().trim() ?? ''}`));
    if (address) { matched = { applicant, address }; break; }
  }
  if (!matched?.address.cityName || !matched.applicant.applicantNameText) return;

  const grantDate = isoDate(meta.grantDate ?? '');
  const publicationDate = isoDate(meta.earliestPublicationDate ?? '');
  const eventDate = grantDate && meta.patentNumber ? grantDate : publicationDate;
  if (!eventDate || eventDate < cutoff || eventDate > new Date().toISOString().slice(0, 10)) return;
  const issued = Boolean(grantDate && meta.patentNumber);
  return {
    source: 'uspto', externalId: number, name: matched.applicant.applicantNameText,
    city: matched.address.cityName, state: 'NJ', signalType: 'ip',
    subtype: issued ? 'issued-patent' : 'published-application', count: 1, date: eventDate,
    sourceUrl: `https://data.uspto.gov/patent-file-wrapper/search/details/${number}/application-data`,
    description: `${issued ? 'Issued US patent' : 'Published US patent application'}: ${meta.inventionTitle ?? number}`,
    raw: { applicationNumber: number, patentNumber: meta.patentNumber ?? null,
      filingDate: meta.filingDate ?? null, publicationDate: publicationDate ?? null,
      grantDate: grantDate ?? null, applicantName: matched.applicant.applicantNameText,
      applicantCity: matched.address.cityName, applicantState: 'NJ', title: meta.inventionTitle ?? null },
  };
}

/** Search public utility applications by known NJ company, then verify applicant name and address. */
export async function fetchUsptoPatents(): Promise<RawRecord[]> {
  const key = process.env.USPTO_API_KEY;
  if (!key) throw new MissingInputError('USPTO_API_KEY is not set');
  const companies = await activeCompanies();
  if (companies.length === 0) throw new MissingInputError('No active companies to search at USPTO');
  const known = new Set(companies.map((company) =>
    `${normalizeName(company.name)}|${company.city.toLowerCase().trim()}`));
  const names = [...new Map(companies.map((company) => [normalizeName(company.name), company.name])).values()]
    .filter((name) => normalizeName(name).length >= 4);
  const cutoff = new Date(Date.now() - 36 * 30.44 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const results = new Map<string, RawRecord>();
  let broad = 0;

  for (const [index, name] of names.entries()) {
    const first = await searchPage(key, name, 0);
    const total = first.count ?? 0;
    if (total > MAX_RESULTS_PER_NAME) {
      broad++;
      console.warn(`USPTO: skipped broad applicant query for ${name} (${total} results)`);
      continue;
    }
    for (let offset = 0; offset < total; offset += PAGE_SIZE) {
      const page = offset === 0 ? first : await searchPage(key, name, offset);
      if ((page.patentFileWrapperDataBag?.length ?? 0) < Math.min(PAGE_SIZE, total - offset)) {
        throw new Error(`USPTO returned an incomplete page for ${name} at offset ${offset}`);
      }
      for (const application of page.patentFileWrapperDataBag ?? []) {
        const record = patentRecord(application, known, cutoff);
        if (record) results.set(record.externalId, record);
      }
    }
    if ((index + 1) % 25 === 0) console.log(`USPTO searched ${index + 1}/${names.length} company names; ${results.size} matched applications`);
  }
  console.log(`USPTO: ${results.size} recent NJ utility applications, ${broad} broad names skipped`);
  return [...results.values()];
}
