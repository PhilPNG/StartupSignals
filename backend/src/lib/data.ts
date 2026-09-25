import fs from 'node:fs';
import path from 'node:path';
import { database } from './supabase';
import type { Company, Dataset, Signal } from './types';

async function allRows<T>(table: 'companies' | 'signals'): Promise<T[]> {
  const db = database();
  const rows: T[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await db.from(table).select('*').order('id').range(start, start + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

export type DatasetName = 'live' | 'sample';

/** `?dataset=sample` serves the labeled sample file; anything else is the live Supabase set. */
export function datasetFromParams(params: URLSearchParams): DatasetName {
  return params.get('dataset') === 'sample' ? 'sample' : 'live';
}

/** Load the active, real company set. Sample data must be requested explicitly. */
export async function loadDataset(dataset: DatasetName = 'live'): Promise<Dataset> {
  if (dataset === 'sample' || process.env.DEMO_SAMPLE_MODE === 'true') {
    const sample = path.join(process.cwd(), 'data', 'sample-companies.json');
    return JSON.parse(fs.readFileSync(sample, 'utf8')) as Dataset;
  }

  const [companyRows, signalRows] = await Promise.all([
    allRows<Record<string, unknown>>('companies'),
    allRows<Record<string, unknown>>('signals'),
  ]);
  const companies: Company[] = companyRows
    .filter((r) => r.active === true && r.is_sample === false)
    .map((r) => ({
      id: String(r.id),
      name: String(r.name),
      address: String(r.address ?? ''),
      city: String(r.city ?? ''),
      county: String(r.county ?? ''),
      lat: typeof r.lat === 'number' ? r.lat : null,
      lng: typeof r.lng === 'number' ? r.lng : null,
      website: typeof r.website === 'string' ? r.website : undefined,
      foundedYear: typeof r.founded_year === 'number' ? r.founded_year : undefined,
      sector: String(r.sector ?? 'Other'),
      industryGroup: typeof r.industry_group === 'string' ? r.industry_group : undefined,
      isSample: false,
    }));
  const ids = new Set(companies.map((c) => c.id));
  const signals: Signal[] = signalRows
    .filter((r) => ids.has(String(r.company_id)))
    .map((r) => ({
      companyId: String(r.company_id),
      type: r.type as Signal['type'],
      subtype: typeof r.subtype === 'string' ? r.subtype : undefined,
      amount: r.amount == null ? undefined : Number(r.amount),
      count: r.count == null ? undefined : Number(r.count),
      date: String(r.event_date),
      source: String(r.source),
      sourceUrl: String(r.source_url ?? ''),
      description: typeof r.description === 'string' ? r.description : undefined,
    }));
  if (companies.length === 0) throw new Error('No active real companies have been published');
  return { companies, signals };
}
