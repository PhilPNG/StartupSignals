import {
  SIGNAL_TYPES,
  type Company,
  type ScoredCompany,
  type Sector,
  type Signal,
  type SignalScores,
  type Weights,
} from './types';

export const DEFAULT_WEIGHTS: Weights = {
  funding: 30,
  grant: 25,
  hiring: 20,
  ip: 15,
  accelerator: 10,
};

const MONTH_MS = 1000 * 60 * 60 * 24 * 30.44;
const COMBINATION_BONUS = 0.1;

/** event weight = 0.5 ^ (months ago / 12) — an event counts half as much every 12 months. */
export function eventWeight(date: string, now = new Date()): number {
  const monthsAgo = Math.max(0, (now.getTime() - new Date(date).getTime()) / MONTH_MS);
  return 0.5 ** (monthsAgo / 12);
}

/** Decayed, log-scaled strength of one company's events of a single signal type. 0 = no signal. */
export function rawSignal(events: Signal[], now = new Date()): number {
  return events.reduce(
    (sum, e) => {
      const ageMonths = (now.getTime() - new Date(e.date).getTime()) / MONTH_MS;
      if (e.type === 'ip' && ageMonths > 36) return sum;
      const value = Math.log10(1 + (e.amount ?? e.count ?? 1));
      let multiplier = 1;
      if (e.type === 'grant' && /phase\s*ii\b/i.test(e.subtype ?? '')) multiplier = 2;
      if (e.type === 'ip' && e.subtype === 'issued-patent') multiplier = 1.5;
      if (e.type === 'accelerator' && e.subtype === 'selective') multiplier = 1.5;
      if (e.type === 'hiring') {
        const technical = Number(e.subtype?.match(/^technical:(\d+)$/)?.[1] ?? 0);
        multiplier += (e.count ?? 0) > 0 ? 0.5 * technical / (e.count ?? 1) : 0;
      }
      return sum + eventWeight(e.date, now) * value * multiplier;
    },
    0,
  );
}

/** Percentile rank (0–100) of each value within the set. Companies without the signal stay at 0. */
export function percentileRanks(values: number[]): number[] {
  return values.map((v) => (v > 0 ? (100 * values.filter((x) => x <= v).length) / values.length : 0));
}

function normalizeWeights(weights: Weights, available: Set<string>): Weights {
  const total = SIGNAL_TYPES.reduce((sum, t) => sum + (available.has(t) ? Math.max(0, weights[t]) : 0), 0) || 1;
  return Object.fromEntries(SIGNAL_TYPES.map((t) => [t, available.has(t) ? Math.max(0, weights[t]) / total : 0])) as Weights;
}

/** Reads weight overrides like `?funding=40&ip=25`; anything missing uses the default. */
export function weightsFromParams(params: URLSearchParams): Weights {
  return Object.fromEntries(
    SIGNAL_TYPES.map((t) => {
      const value = Number(params.get(t));
      return [t, params.has(t) && Number.isFinite(value) ? value : DEFAULT_WEIGHTS[t]];
    }),
  ) as Weights;
}

/**
 * Startup Score = min(100, Σ wᵢ·sᵢ × (1 + 0.10 × (signal types − 1)))
 * where sᵢ is the company's percentile rank for signal i within the NJ set.
 */
export function scoreCompanies(
  companies: Company[],
  signals: Signal[],
  weights: Weights = DEFAULT_WEIGHTS,
  now = new Date(),
): ScoredCompany[] {
  const eventsByCompany = new Map<string, Signal[]>();
  for (const s of signals) {
    eventsByCompany.set(s.companyId, [...(eventsByCompany.get(s.companyId) ?? []), s]);
  }

  const raw = Object.fromEntries(
    SIGNAL_TYPES.map((t) => [
      t,
      companies.map((c) => rawSignal((eventsByCompany.get(c.id) ?? []).filter((s) => s.type === t), now)),
    ]),
  ) as Record<keyof Weights, number[]>;
  // A globally unavailable source cannot silently lower every company's score.
  const available = new Set(SIGNAL_TYPES.filter((t) => raw[t].some((value) => value > 0)));
  const w = normalizeWeights(weights, available);
  const pct = Object.fromEntries(SIGNAL_TYPES.map((t) => [t, percentileRanks(raw[t])])) as Record<
    keyof Weights,
    number[]
  >;

  const scored = companies.map((company, i): ScoredCompany => {
    const signalScores = {} as SignalScores;
    const contributions = {} as SignalScores;
    let signalTypes = 0;
    for (const t of SIGNAL_TYPES) {
      signalScores[t] = pct[t][i];
      if (raw[t][i] > 0) signalTypes++;
    }

    const bonus = 1 + COMBINATION_BONUS * Math.max(0, signalTypes - 1);
    const uncapped = SIGNAL_TYPES.reduce((sum, t) => sum + w[t] * signalScores[t] * bonus, 0);
    const score = Math.min(100, uncapped);
    const scale = uncapped > 0 ? score / uncapped : 0;
    for (const t of SIGNAL_TYPES) contributions[t] = w[t] * signalScores[t] * bonus * scale;

    return { ...company, signalScores, contributions, signalTypes, score, rank: 0 };
  });

  scored.sort((a, b) => b.score - a.score).forEach((c, i) => (c.rank = i + 1));
  return scored;
}

/**
 * Sector score combines depth (total score of the top companies), breadth (companies with 2+
 * signal types) and growth (signal activity in the last 12 months vs the 12 before).
 */
export function scoreSectors(scored: ScoredCompany[], signals: Signal[], now = new Date()): Sector[] {
  const TOP_N = 5;
  const yearAgo = new Date(now.getTime() - 12 * MONTH_MS);
  const twoYearsAgo = new Date(now.getTime() - 24 * MONTH_MS);
  const sectorOf = new Map(scored.map((c) => [c.id, c.sector]));

  const bySector = new Map<string, ScoredCompany[]>();
  for (const c of scored) bySector.set(c.sector, [...(bySector.get(c.sector) ?? []), c]);

  const rows: Sector[] = [...bySector].map(([sector, members]) => {
    const depth = members
      .map((c) => c.score)
      .sort((a, b) => b - a)
      .slice(0, TOP_N)
      .reduce((sum, s) => sum + s, 0);
    const breadth = members.filter((c) => c.signalTypes >= 2).length;

    const dates = signals.filter((s) => sectorOf.get(s.companyId) === sector).map((s) => new Date(s.date));
    const current = dates.filter((d) => d > yearAgo).length;
    const previous = dates.filter((d) => d > twoYearsAgo && d <= yearAgo).length;
    const growth = previous > 0 ? (current - previous) / previous : current > 0 ? 1 : 0;

    return { sector, companies: members.length, depth, breadth, growth, sectorScore: 0 };
  });

  // TODO: tune the combination. For now each component is scaled to the best sector and averaged.
  const max = (pick: (r: Sector) => number) => Math.max(...rows.map(pick), 1e-9);
  const maxDepth = max((r) => r.depth);
  const maxBreadth = max((r) => r.breadth);
  const maxGrowth = max((r) => Math.max(0, r.growth));
  for (const r of rows) {
    r.sectorScore =
      (100 * (r.depth / maxDepth + r.breadth / maxBreadth + Math.max(0, r.growth) / maxGrowth)) / 3;
  }

  return rows.sort((a, b) => b.sectorScore - a.sectorScore);
}
