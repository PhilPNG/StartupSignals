import fs from 'node:fs';
import path from 'node:path';

import { supabase } from './enrichment/supabase';
import type {
  Company,
  Dataset,
  Signal,
  SignalType,
} from '../lib/types';

const OUTPUT = path.join(
  process.cwd(),
  'data',
  'companies.json'
);

async function main() {
  console.log('Loading companies from Supabase...');

  const {
    data: companyRows,
    error: companyError,
  } = await supabase
    .from('companies')
    .select(`
      id,
      name,
      address,
      city,
      county,
      lat,
      lng,
      website,
      founded_year,
      sector,
      industry_group,
      is_sample
    `)
    .eq('active', true);

  if (companyError) {
    throw companyError;
  }

  console.log(
    `Loaded ${companyRows?.length ?? 0} companies`
  );

  console.log('Loading signals from Supabase...');

  const {
    data: signalRows,
    error: signalError,
  } = await supabase
    .from('signals')
    .select(`
      company_id,
      type,
      amount,
      count,
      event_date,
      source,
      source_url,
      description
    `);

  if (signalError) {
    throw signalError;
  }

  console.log(
    `Loaded ${signalRows?.length ?? 0} signals`
  );

  const companies: Company[] = (companyRows ?? [])
    .filter(
      (c) =>
        c.id &&
        c.name &&
        c.city &&
        c.lat !== null &&
        c.lng !== null
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      address: c.address ?? '',
      city: c.city,
      county: c.county ?? '',
      lat: Number(c.lat),
      lng: Number(c.lng),
      website: c.website ?? undefined,
      foundedYear: c.founded_year ?? undefined,
      sector: c.sector ?? 'Other',
      industryGroup: c.industry_group ?? undefined,
      isSample: c.is_sample ?? false,
    }));

  const companyIds = new Set(
    companies.map((c) => c.id)
  );

  const signals: Signal[] = (signalRows ?? [])
    .filter(
      (s) =>
        companyIds.has(s.company_id) &&
        s.type &&
        s.event_date &&
        s.source &&
        s.source_url
    )
    .map((s) => ({
      companyId: s.company_id,
      type: s.type as SignalType,
      amount:
        s.amount !== null
          ? Number(s.amount)
          : undefined,
      count: s.count ?? undefined,
      date: s.event_date,
      source: s.source,
      sourceUrl: s.source_url,
      description: s.description ?? undefined,
    }));

  const dataset: Dataset = {
    companies,
    signals,
  };

  fs.writeFileSync(
    OUTPUT,
    JSON.stringify(dataset, null, 2)
  );

  console.log(
    `Exported ${companies.length} companies`
  );
  console.log(
    `Exported ${signals.length} signals`
  );
  console.log(`Wrote ${OUTPUT}`);
}

main().catch((error) => {
  console.error(
    'Dataset export failed:',
    error
  );
  process.exit(1);
});