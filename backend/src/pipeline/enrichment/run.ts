/**
 * Writes an LLM summary report per published company to `company_ai_enrichment`.
 *
 *   npm run enrich -w backend                 # next 5 companies without a report
 *   npm run enrich -w backend -- --limit 20
 *   npm run enrich -w backend -- --all        # every company without a report
 *   npm run enrich -w backend -- --force      # also regenerate existing reports
 *   npm run enrich -w backend -- --dry-run    # print the evidence; no OpenAI calls or writes
 *
 * Needs SUPABASE_URL, SUPABASE_SECRET_KEY and OPENAI_API_KEY (OPENAI_MODEL is optional).
 */
import { analyzeCompany, MODEL, type CompanyEvidence } from './analyze';
import { loadDataset } from '../../lib/data';
import { database } from '../../lib/supabase';
import type { Company, Signal } from '../../lib/types';

const CONCURRENCY = 4;

function option(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

const sum = (signals: Signal[]) => signals.reduce((total, s) => total + (s.amount ?? 0), 0);

function buildEvidence(company: Company, signals: Signal[], asOf: Date): CompanyEvidence {
  const byDate = [...signals].sort((a, b) => b.date.localeCompare(a.date));
  const yearAgo = new Date(asOf);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const grants = byDate.filter((s) => s.type === 'grant');
  const funding = byDate.filter((s) => s.type === 'funding');
  return {
    asOfDate: asOf.toISOString().slice(0, 10),
    company: {
      name: company.name,
      city: company.city,
      county: company.county,
      sector: company.sector,
      industryGroup: company.industryGroup,
      website: company.website,
      foundedYear: company.foundedYear,
    },
    metrics: {
      signalCount: byDate.length,
      signalsLast12Months: byDate.filter((s) => s.date >= yearAgo.toISOString().slice(0, 10)).length,
      grantCount: grants.length,
      totalGrantAmount: sum(grants),
      fundingCount: funding.length,
      totalFundingAmount: sum(funding),
      latestSignalDate: byDate[0]?.date ?? null,
    },
    signals: byDate.map((s) => ({
      source: s.source,
      type: s.type,
      subtype: s.subtype,
      amount: s.amount,
      date: s.date,
      description: s.description,
    })),
  };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  const limit = process.argv.includes('--all') ? Infinity : Number(option('--limit') ?? 5);
  if (!(limit > 0)) throw new Error('--limit must be a positive number');
  if (!dryRun && !process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required (or pass --dry-run)');

  const db = database();
  const { companies, signals } = await loadDataset();
  if (companies.some((c) => c.isSample)) throw new Error('Loaded sample data; unset DEMO_SAMPLE_MODE to enrich live companies');

  const { data: existing, error } = await db.from('company_ai_enrichment').select('company_id');
  if (error) throw new Error(`company_ai_enrichment: ${error.message} (apply the migration first)`);
  const done = new Set((existing ?? []).map((row) => String(row.company_id)));

  const byCompany = new Map<string, Signal[]>();
  for (const s of signals) {
    const list = byCompany.get(s.companyId);
    if (list) list.push(s);
    else byCompany.set(s.companyId, [s]);
  }
  const queue = companies
    .filter((c) => byCompany.has(c.id) && (force || !done.has(c.id)))
    .slice(0, limit);
  console.log(`${queue.length} companies to summarize with ${MODEL} (${done.size} already have a report)`);

  const asOf = new Date();
  let written = 0;
  let failed = 0;
  let next = 0;
  async function worker() {
    while (next < queue.length) {
      const company = queue[next++];
      const companySignals = byCompany.get(company.id) ?? [];
      const evidence = buildEvidence(company, companySignals, asOf);
      if (dryRun) {
        console.dir(evidence, { depth: null });
        continue;
      }
      try {
        const result = await analyzeCompany(evidence);
        const { error: writeError } = await db.from('company_ai_enrichment').upsert({
          company_id: company.id,
          summary: result.summary,
          momentum_summary: result.momentumSummary,
          key_signals: result.keySignals,
          evidence_sources: [...new Set(companySignals.map((s) => s.source))],
          generated_at: new Date().toISOString(),
        }, { onConflict: 'company_id' });
        if (writeError) throw new Error(writeError.message);
        written++;
        console.log(`✓ ${company.name}`);
      } catch (e) {
        failed++;
        console.warn(`✗ ${company.name}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (!dryRun) console.log(`Wrote ${written} summary reports; ${failed} failed`);
  if (failed) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
