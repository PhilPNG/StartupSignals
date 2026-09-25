import { assignSector } from './cluster';
import { geocodeCompanies } from './geocode';
import { buildDataset, matchKey, normalizeName } from './match';
import { MissingInputError } from './source-utils';
import { loadAccelerators } from './sources/accelerators';
import { fetchFormD, fetchRecentFormD } from './sources/funding';
import { fetchNihGrants, fetchNsfGrants, fetchSbirAwards, loadNjedaAwards } from './sources/grants';
import { fetchAdzunaJobs, fetchAtsJobs } from './sources/hiring';
import { fetchPatentsAndTrademarks } from './sources/ip';
import type { RawRecord } from './types';
import { database } from '../lib/supabase';

const sources: { name: string; load: () => Promise<RawRecord[]> }[] = [
  { name: 'sec-form-d', load: fetchFormD },
  { name: 'sec-recent', load: fetchRecentFormD },
  { name: 'sbir', load: fetchSbirAwards },
  { name: 'nih', load: fetchNihGrants },
  { name: 'nsf', load: fetchNsfGrants },
  { name: 'njeda', load: loadNjedaAwards },
  { name: 'ats', load: fetchAtsJobs },
  { name: 'adzuna', load: fetchAdzunaJobs },
  { name: 'accelerator', load: loadAccelerators },
  { name: 'uspto', load: fetchPatentsAndTrademarks },
];

function chunks<T>(rows: T[], size = 200): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < rows.length; i += size) result.push(rows.slice(i, i + size));
  return result;
}

async function readAll(table: 'source_records' | 'company_aliases' | 'companies' | 'ingestion_runs') {
  const db = database();
  const all: Record<string, unknown>[] = [];
  for (let start = 0; ; start += 1000) {
    let query = db.from(table).select('*');
    query = table === 'source_records'
      ? query.order('source').order('external_id')
      : query.order('id');
    query = query.range(start, start + 999);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    all.push(...(data ?? []));
    if ((data ?? []).length < 1000) return all;
  }
}

async function ingestSource(name: string, load: () => Promise<RawRecord[]>): Promise<void> {
  const db = database();
  const { data: run, error: startError } = await db.from('ingestion_runs')
    .insert({ source: name, status: 'running' }).select('id').single();
  if (startError || !run) throw new Error(`Could not start ${name}: ${startError?.message}`);
  let status: 'failed' | 'skipped' | null = null;
  let rowsFetched = 0;
  let rowsAccepted = 0;
  let errorSummary: string | null = null;
  try {
    const records = await load();
    rowsFetched = records.length;
    if (records.length === 0) throw new Error(`${name} returned zero records; previous data retained`);
    const usable = records.filter((r) => r.source && r.externalId && r.name);
    rowsAccepted = usable.length;
    for (const batch of chunks(usable)) {
      const { error } = await db.from('source_record_staging').upsert(batch.map((r) => ({
        source: r.source, external_id: r.externalId, source_url: r.sourceUrl ?? null,
        event_date: r.date ?? null, run_id: run.id,
        payload: r,
      })), { onConflict: 'run_id,source,external_id' });
      if (error) throw new Error(`${name} staging: ${error.message}`);
    }
    const { error: countError } = await db.from('ingestion_runs').update({ rows_fetched: rowsFetched })
      .eq('id', run.id);
    if (countError) throw new Error(`${name} fetched count: ${countError.message}`);
    const { error: commitError } = await db.rpc('commit_source_run', { p_run_id: run.id });
    if (commitError) throw new Error(`${name} commit: ${commitError.message}`);
    console.log(`${name}: ${rowsAccepted} records`);
  } catch (error) {
    status = error instanceof MissingInputError ? 'skipped' : 'failed';
    errorSummary = error instanceof Error ? error.message : String(error);
    console.warn(`${name}: ${status} — ${errorSummary}`);
  }
  if (status) {
    const { error: finishError } = await db.from('ingestion_runs').update({
      completed_at: new Date().toISOString(), status, rows_fetched: rowsFetched,
      rows_accepted: rowsAccepted, error_summary: errorSummary,
    }).eq('id', run.id);
    if (finishError) throw new Error(`Could not finish ${name}: ${finishError.message}`);
  }
}

async function main() {
  database(); // Fail before any source work if credentials are absent.
  const selected = process.env.PIPELINE_SOURCES?.split(',').map((s) => s.trim()).filter(Boolean);
  for (const source of sources.filter((item) => !selected || selected.includes(item.name))) {
    await ingestSource(source.name, source.load);
  }

  const db = database();
  const [stored, aliasRows, existing, runs] = await Promise.all([
    readAll('source_records'), readAll('company_aliases'), readAll('companies'), readAll('ingestion_runs'),
  ]);
  const latestSuccessfulRun = new Map<string, Record<string, unknown>>();
  for (const run of runs.filter((row) => row.status === 'success')) {
    const source = String(run.source);
    const previous = latestSuccessfulRun.get(source);
    if (!previous || String(run.started_at) > String(previous.started_at)) latestSuccessfulRun.set(source, run);
  }
  const currentRunIds = new Set([...latestSuccessfulRun.values()].map((run) => String(run.id)));
  const records = stored.filter((row) => currentRunIds.has(String(row.run_id)))
    .map((row) => row.payload as RawRecord).filter((r) => r?.externalId);
  const aliases = new Map(aliasRows.filter((row) => row.reviewed_at).map((row) => [
    `${String(row.normalized_alias)}|${String(row.city).toLowerCase().trim()}`,
    String(row.company_id),
  ]));
  const { dataset, review } = buildDataset(records, aliases);
  if (dataset.companies.length === 0) throw new Error('No verified NJ master companies; publication cancelled');

  const existingById = new Map(existing.map((row) => [String(row.id), row]));
  for (const company of dataset.companies) {
    const previous = existingById.get(company.id);
    if (previous) {
      company.lat = typeof previous.lat === 'number' ? previous.lat : null;
      company.lng = typeof previous.lng === 'number' ? previous.lng : null;
      company.county = String(previous.county ?? '');
      company.geocodeConfidence = typeof previous.geocode_confidence === 'string' ? previous.geocode_confidence : undefined;
    }
    const text = dataset.signals.filter((s) => s.companyId === company.id).map((s) => s.description ?? '').join(' ');
    company.sector = assignSector(company.industryGroup, text);
  }
  await geocodeCompanies(dataset.companies);

  const companyRows = dataset.companies.map((c) => ({
    id: c.id, canonical_key: matchKey(c.name, c.city), name: c.name,
    normalized_name: normalizeName(c.name), address: c.address || null,
    city: c.city, county: c.county || null, lat: c.lat, lng: c.lng,
    website: c.website ?? null, founded_year: c.foundedYear ?? null,
    sector: c.sector, industry_group: c.industryGroup ?? null,
    geocode_confidence: c.geocodeConfidence ?? null,
  }));
  const signalRows = dataset.signals.map((s) => ({
    company_id: s.companyId, source: s.source, external_id: s.externalId,
    type: s.type, subtype: s.subtype ?? null, amount: s.amount ?? null,
    count: s.count ?? null, event_date: s.date, source_url: s.sourceUrl,
    description: s.description ?? null,
  }));
  const { error } = await db.rpc('publish_dataset', { p_companies: companyRows, p_signals: signalRows });
  if (error) throw new Error(`Publishing dataset failed: ${error.message}`);

  for (const batch of chunks(review)) {
    const { error: reviewError } = await db.from('match_review').upsert(batch.map((item) => ({
      source: item.record.source, external_id: item.record.externalId,
      candidate_company_id: item.candidateCompanyId, reason: item.reason, status: 'pending',
    })), { onConflict: 'source,external_id', ignoreDuplicates: true });
    if (reviewError) throw new Error(`Match review queue: ${reviewError.message}`);
  }
  console.log(`Published ${dataset.companies.length} companies, ${dataset.signals.length} signals; ${review.length} candidates for review`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
