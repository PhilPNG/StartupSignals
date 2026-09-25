import fs from 'node:fs';
import path from 'node:path';
import { assignSector } from './cluster';
import { isExcluded, isNewJersey } from './filter';
import { geocodeCompanies } from './geocode';
import { buildDataset } from './match';
import { loadAccelerators } from './sources/accelerators';
import { fetchFormD, fetchRecentFormD } from './sources/funding';
import { fetchNihGrants, fetchNsfGrants, fetchSbirAwards, loadNjedaAwards } from './sources/grants';
import { fetchAdzunaJobs, fetchAtsJobs } from './sources/hiring';
import { fetchPatentsAndTrademarks } from './sources/ip';

const OUTPUT = path.join(process.cwd(), 'data', 'companies.json');

async function main() {
  console.log('1/5 Ingest');
  const sources = [
    fetchFormD,
    fetchRecentFormD,
    fetchSbirAwards,
    fetchNihGrants,
    fetchNsfGrants,
    loadNjedaAwards,
    fetchPatentsAndTrademarks,
    fetchAdzunaJobs,
    fetchAtsJobs,
    loadAccelerators,
  ];
  const records = (await Promise.all(sources.map((fetchSource) => fetchSource()))).flat();
  console.log(`    ${records.length} raw records`);

  console.log('2/5 Filter');
  const kept = records.filter((r) => isNewJersey(r) && !isExcluded(r));
  console.log(`    ${kept.length} kept`);

  console.log('3/5 Match');
  const dataset = buildDataset(kept);
  console.log(`    ${dataset.companies.length} companies, ${dataset.signals.length} signals`);

  console.log('4/5 Geocode');
  await geocodeCompanies(dataset.companies);

  console.log('5/5 Cluster');
  for (const company of dataset.companies) {
    const text = dataset.signals
      .filter((s) => s.companyId === company.id)
      .map((s) => s.description ?? '')
      .join(' ');
    company.sector = assignSector(company.industryGroup, text);
  }

  // Scoring runs at request time (src/lib/scoring.ts) so the weight sliders can re-rank live.
  if (dataset.companies.length === 0) {
    console.log('No companies yet — leaving data/companies.json alone; the API keeps serving sample data.');
    return;
  }
  fs.writeFileSync(OUTPUT, JSON.stringify(dataset, null, 2));
  console.log(`Wrote ${OUTPUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
