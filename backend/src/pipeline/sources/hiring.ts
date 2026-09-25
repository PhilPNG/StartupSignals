import type { RawRecord } from '../types';

/**
 * Adzuna job search — free key (ADZUNA_APP_ID / ADZUNA_APP_KEY).
 * GET https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=…&app_key=…&where=New%20Jersey&what=<company>
 */
export async function fetchAdzunaJobs(): Promise<RawRecord[]> {
  // TODO: one query per master-list company; count open roles and technical share.
  return [];
}

/**
 * Public ATS job boards — no key, only for companies that use that ATS.
 * Greenhouse: GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs
 * Lever:      GET https://api.lever.co/v0/postings/{slug}?mode=json
 * Ashby:      GET https://api.ashbyhq.com/posting-api/job-board/{slug}
 * Find the slug on each company's careers page. Poll every few hours, not on page load.
 */
export async function fetchAtsJobs(): Promise<RawRecord[]> {
  // TODO
  return [];
}
