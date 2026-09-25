import type { Signal, SignalType } from '../types';

/** Plain-language meaning of each score input; shown in weight tooltips and the detail view. */
export const SIGNAL_DESCRIPTIONS: Record<SignalType, string> = {
  funding: 'Private capital raised, from SEC Form D filings. Scored on amount raised and number of rounds.',
  grant: 'Non-dilutive funding: SBIR/STTR, NIH and NSF grants plus NJEDA program approvals. Scored on award dollars; SBIR Phase II counts double.',
  hiring: 'Open roles and the share of technical roles, from public Greenhouse, Lever and Ashby job boards.',
  ip: 'Recent patent and trademark filings from the USPTO. Older filings are not counted.',
  accelerator: 'Time in an NJ accelerator or university incubator, with a boost for selective programs.',
};

interface SourceInfo {
  name: string;
  /** How often the upstream publisher updates the data. */
  cadence: string;
  /** How the pipeline pulls it. */
  method: string;
}

const SOURCES: { match: RegExp; info: SourceInfo }[] = [
  {
    match: /form[\s-]?d|sec/i,
    info: {
      name: 'SEC Form D',
      cadence: 'Filed within 15 days of a first sale; SEC publishes bulk data sets quarterly',
      method: 'Quarterly Form D data sets, filtered to NJ issuers; pooled funds and raises over $100M excluded',
    },
  },
  {
    match: /sbir|sttr/i,
    info: {
      name: 'SBIR / STTR',
      cadence: 'Awards posted as agencies report them; bulk files refreshed periodically',
      method: 'SBIR.gov bulk award files, NJ awards from the last 5 years',
    },
  },
  {
    match: /nih|reporter/i,
    info: {
      name: 'NIH RePORTER',
      cadence: 'Updated weekly',
      method: 'RePORTER API, NJ small-business awards (R43, R44, U44)',
    },
  },
  {
    match: /nsf/i,
    info: { name: 'NSF Awards', cadence: 'Updated daily', method: 'NSF Awards API, NJ awardees since last year' },
  },
  {
    match: /njeda/i,
    info: {
      name: 'NJEDA',
      cadence: 'Approvals published after monthly board meetings',
      method: 'Copied by hand from NJEDA board materials, each row with a public source link',
    },
  },
  {
    match: /uspto|patent|trademark/i,
    info: { name: 'USPTO', cadence: 'Updated weekly', method: 'USPTO Open Data Portal, NJ assignees' },
  },
  {
    match: /\bats\b|job|greenhouse|lever|ashby|hiring/i,
    info: {
      name: 'Job boards',
      cadence: 'Live postings, polled every few hours',
      method: 'Public Greenhouse, Lever and Ashby job boards',
    },
  },
  {
    match: /accelerator|incubator/i,
    info: {
      name: 'Accelerator list',
      cadence: 'Updated when programs announce cohorts',
      method: 'Curated by hand from NJ accelerator and university incubator portfolio pages',
    },
  },
];

export function sourceInfo(source: string): SourceInfo {
  return SOURCES.find((s) => s.match.test(source))?.info ?? { name: source, cadence: 'Varies', method: 'Imported record' };
}

/** "2026-03-10" → "2026 Q1". */
export function quarterOf(date: string): string {
  const [year, month] = date.split('-').map(Number);
  return `${year} Q${Math.ceil((month || 1) / 3)}`;
}

/** The last `count` calendar quarters ending with the one containing `now`, oldest first. */
export function recentQuarters(now: Date, count: number): string[] {
  const quarters: string[] = [];
  let year = now.getFullYear();
  let q = Math.floor(now.getMonth() / 3) + 1;
  for (let i = 0; i < count; i++) {
    quarters.unshift(`${year} Q${q}`);
    q -= 1;
    if (q === 0) {
      q = 4;
      year -= 1;
    }
  }
  return quarters;
}

/** Unrounded months from `from` to `to`; use for window checks like "last 12 months". */
export function monthsSince(from: string, to: Date): number {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(from) ? new Date(`${from}T00:00:00`) : new Date(from);
  return Math.max(0, (to.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
}

/** Whole months, for display ("7 mo ago"). */
export function monthsBetween(from: string, to: Date): number {
  return Math.round(monthsSince(from, to));
}

export const sumAmounts = (signals: Signal[]) => signals.reduce((sum, s) => sum + (s.amount ?? 0), 0);
