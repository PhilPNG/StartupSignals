import fs from 'node:fs';
import { parse } from 'csv-parse';
import type { RawRecord } from '../types';
import { fetchJson, field, isoDate, localFiles, MissingInputError, money, parseTable } from '../source-utils';

type Row = Record<string, unknown>;

/** SBIR award bulk JSON or CSV from sbir.gov/data-resources. */
export async function fetchSbirAwards(): Promise<RawRecord[]> {
  const file = localFiles(/^sbir[^/]*\.(json|csv)$/i).at(-1);
  if (!file) throw new MissingInputError('Download SBIR award bulk JSON/CSV to backend/data/raw/sbir-awards.json or .csv');
  let rows: AsyncIterable<unknown>;
  if (file.endsWith('.csv')) {
    rows = fs.createReadStream(file).pipe(parse({ columns: true, bom: true, skip_empty_lines: true, trim: true }));
  } else {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    const awards = Array.isArray(parsed) ? parsed : (parsed as { results?: unknown[]; awards?: unknown[] }).results
      ?? (parsed as { awards?: unknown[] }).awards;
    if (!Array.isArray(awards)) throw new Error('SBIR bulk JSON must contain an award array');
    rows = (async function* () { yield* awards; })();
  }
  const byAward = new Map<string, RawRecord>();
  for await (const value of rows) {
    if (!value || typeof value !== 'object') continue;
    const row = value as Row;
    if (!['NJ', 'NEW JERSEY'].includes(field(row, 'state', 'company_state').toUpperCase())) continue;
    const awardYear = Number(field(row, 'award_year'));
    if (!Number.isFinite(awardYear) || awardYear < new Date().getFullYear() - 5) continue;
    const name = field(row, 'firm', 'company', 'company_name');
    const city = field(row, 'city', 'company_city');
    const awardId = field(row, 'award_id', 'id', 'agency_tracking_number', 'contract');
    const date = isoDate(field(row, 'proposal_award_date', 'award_date', 'award_year'));
    if (!name || !city || !awardId || !date) continue;
    const phase = field(row, 'phase');
    const agency = field(row, 'agency');
    const externalId = `${agency}:${awardId}:${phase}`;
    const record: RawRecord = {
      source: 'sbir', externalId, name, city, state: 'NJ',
      address: [field(row, 'address1', 'address'), field(row, 'address2')].filter(Boolean).join(', '),
      website: field(row, 'company_url', 'company_website', 'website') || undefined,
      uei: field(row, 'uei') || undefined,
      signalType: 'grant', subtype: phase || 'SBIR',
      amount: money(field(row, 'award_amount', 'amount')), count: 1, date,
      sourceUrl: field(row, 'award_link', 'source_url') || 'https://www.sbir.gov/data-resources',
      description: `${field(row, 'award_title', 'title') || `SBIR/STTR ${phase} award`} (${agency} ${awardId})`,
      raw: { agency, agency_tracking_number: awardId, phase, awardYear,
        contract: field(row, 'contract'), program: field(row, 'program') },
    };
    const previous = byAward.get(externalId);
    if (!previous || (previous.date ?? '') < date) byAward.set(externalId, record);
  }
  return [...byAward.values()];
}

type NihResponse = { meta?: { total?: number }; results?: Row[] };

/** Only small-business NIH activity codes; each page is at most 500 projects. */
export async function fetchNihGrants(): Promise<RawRecord[]> {
  const results: RawRecord[] = [];
  const year = new Date().getFullYear();
  for (let offset = 0; ; offset += 500) {
    if (offset > 14_999) throw new Error('NIH result cap reached; split the query by fiscal year');
    const data = await fetchJson<NihResponse>('https://api.reporter.nih.gov/v2/projects/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ criteria: { org_states: ['NJ'], fiscal_years: [year - 1, year], activity_codes: ['R43', 'R44', 'U44'] }, offset, limit: 500 }),
    });
    const page = data.results ?? [];
    for (const row of page) {
      const org = (row.organization && typeof row.organization === 'object' ? row.organization : row) as Row;
      const name = field(org, 'org_name', 'organization_name');
      const city = field(org, 'org_city', 'organization_city');
      const state = field(org, 'org_state', 'organization_state');
      const id = field(row, 'appl_id', 'application_id');
      const date = isoDate(field(row, 'award_notice_date', 'project_start_date'));
      if (!name || !city || state.toUpperCase() !== 'NJ' || !id || !date) continue;
      results.push({ source: 'nih', externalId: id, name, city, state: 'NJ',
        uei: field(org, 'org_uei', 'uei') || undefined,
        signalType: 'grant', subtype: field(row, 'activity_code'),
        amount: money(field(row, 'award_amount')), count: 1, date,
        sourceUrl: `https://reporter.nih.gov/project-details/${id}`,
        description: field(row, 'project_title', 'title') || 'NIH small business award',
        raw: { appl_id: id, project_num: field(row, 'project_num'), activity_code: field(row, 'activity_code'),
          award_notice_date: date, org_uei: field(org, 'org_uei', 'uei') } });
    }
    if (page.length < 500 || offset + page.length >= (data.meta?.total ?? Infinity)) break;
  }
  return results;
}

type NsfResponse = { response?: { award?: Row[]; metadata?: { totalCount?: string | number } } };

/** NSF API caps pages at 25 and a query at 3,000; restrict to recent NJ awards. */
export async function fetchNsfGrants(): Promise<RawRecord[]> {
  const results: RawRecord[] = [];
  const year = new Date().getFullYear();
  for (let offset = 0; ; offset += 25) {
    if (offset >= 3000) throw new Error('NSF 3,000-result cap reached; split the date window');
    const url = new URL('https://api.nsf.gov/services/v1/awards.json');
    url.searchParams.set('awardeeStateCode', 'NJ');
    url.searchParams.set('dateStart', `01/01/${year - 1}`);
    url.searchParams.set('rpp', '25');
    url.searchParams.set('offset', String(offset));
    const data = await fetchJson<NsfResponse>(url.toString());
    const page = data.response?.award ?? [];
    for (const row of page) {
      const name = field(row, 'awardeeName');
      const city = field(row, 'awardeeCity');
      const id = field(row, 'id');
      const date = isoDate(field(row, 'date', 'startDate'));
      if (!name || !city || !id || !date) continue;
      results.push({ source: 'nsf', externalId: id, name, city, state: 'NJ',
        uei: field(row, 'ueiNumber') || undefined,
        signalType: 'grant', amount: money(field(row, 'fundsObligatedAmt', 'estimatedTotalAmt')),
        count: 1, date, sourceUrl: `https://www.nsf.gov/awardsearch/showAward?AWD_ID=${encodeURIComponent(id)}`,
        description: field(row, 'title') || 'NSF award',
        raw: { id, ueiNumber: field(row, 'ueiNumber'), fundProgramName: field(row, 'fundProgramName'),
          awardeeStateCode: field(row, 'awardeeStateCode'), startDate: field(row, 'startDate') } });
    }
    const total = Number(data.response?.metadata?.totalCount ?? Infinity);
    if (page.length < 25 || offset + page.length >= total) break;
  }
  // NSF may return multiple action rows for one award. Keep the latest action.
  const byId = new Map<string, RawRecord>();
  for (const record of results) {
    const previous = byId.get(record.externalId);
    if (!previous || (previous.date ?? '') < (record.date ?? '')) byId.set(record.externalId, record);
  }
  return [...byId.values()];
}

/** Curated NJEDA approvals; require a public source URL for each row. */
export async function loadNjedaAwards(): Promise<RawRecord[]> {
  const file = localFiles(/^njeda\.csv$/i)[0];
  if (!file) throw new MissingInputError('Add backend/data/raw/njeda.csv to enable NJEDA');
  return parseTable(fs.readFileSync(file, 'utf8')).flatMap((row): RawRecord[] => {
    const name = field(row, 'company', 'name');
    const city = field(row, 'city');
    const date = isoDate(field(row, 'approval_date', 'date'));
    const url = field(row, 'source_url');
    if (!name || !city || !date || !url) return [];
    return [{ source: 'njeda', externalId: field(row, 'approval_id') || `${name}:${date}`,
      name, city, state: 'NJ', signalType: 'grant', subtype: field(row, 'program') || 'NJEDA',
      amount: money(field(row, 'amount')), count: 1, date, sourceUrl: url,
      description: field(row, 'program', 'description') || 'NJEDA approval', raw: row }];
  });
}
