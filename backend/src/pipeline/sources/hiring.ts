import fs from 'node:fs';
import type { RawRecord } from '../types';
import { fetchJson, field, localFiles, MissingInputError, parseTable } from '../source-utils';

type Job = Record<string, unknown>;

function isTechnical(job: Job): boolean {
  const text = [job.title, job.department, job.team].filter(Boolean).join(' ');
  return /engineer|developer|data scientist|machine learning|product designer|security|research scientist/i.test(text);
}

/** Verified board slugs are supplied in data/raw/ats-boards.csv. */
export async function fetchAtsJobs(): Promise<RawRecord[]> {
  const file = localFiles(/^ats-boards\.csv$/i)[0];
  if (!file) throw new MissingInputError('Add backend/data/raw/ats-boards.csv to enable job boards');
  const boards = parseTable(fs.readFileSync(file, 'utf8'));
  const records: RawRecord[] = [];
  for (const board of boards) {
    const provider = field(board, 'provider').toLowerCase();
    const slug = field(board, 'slug');
    const name = field(board, 'company', 'name');
    const city = field(board, 'city');
    const sourceUrl = field(board, 'source_url');
    if (!provider || !slug || !name || !city || !sourceUrl) continue;
    let jobs: Job[];
    if (provider === 'greenhouse') {
      const data = await fetchJson<{ jobs?: Job[] }>(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`);
      jobs = data.jobs ?? [];
    } else if (provider === 'lever') {
      jobs = await fetchJson<Job[]>(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`);
    } else if (provider === 'ashby') {
      const data = await fetchJson<{ jobs?: Job[] }>(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`);
      jobs = (data.jobs ?? []).filter((job) => job.isListed !== false);
    } else {
      throw new Error(`Unknown ATS provider ${provider}`);
    }
    const technical = jobs.filter(isTechnical).length;
    records.push({ source: `ats-${provider}`, externalId: slug, name, city, state: 'NJ',
      signalType: 'hiring', subtype: `technical:${technical}`, count: jobs.length,
      date: new Date().toISOString().slice(0, 10), sourceUrl,
      description: `${jobs.length} open roles; ${technical} technical`,
      raw: { board, jobs: jobs.map((job) => ({ id: job.id, title: job.title, updatedAt: job.updatedAt })) } });
  }
  return records;
}

/** Adzuna text matches need employer verification; keep this source disabled for scoring. */
export async function fetchAdzunaJobs(): Promise<RawRecord[]> {
  throw new MissingInputError('Adzuna discovery is not enabled without employer verification');
}
