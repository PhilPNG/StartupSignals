import type { CompanyDetail, DatasetName, Health, ScoredCompany, Sector, Weights } from './types';

function query(weights: Weights, dataset: DatasetName): string {
  const params = new URLSearchParams(Object.entries(weights).map(([k, v]) => [k, String(v)]));
  if (dataset === 'sample') params.set('dataset', 'sample');
  return params.toString();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} (${path})`);
  return res.json() as Promise<T>;
}

export const fetchCompanies = (weights: Weights, dataset: DatasetName) =>
  get<ScoredCompany[]>(`/api/companies?${query(weights, dataset)}`);

export const fetchCompany = (id: string, weights: Weights, dataset: DatasetName) =>
  get<CompanyDetail>(`/api/companies/${encodeURIComponent(id)}?${query(weights, dataset)}`);

export const fetchSectors = (weights: Weights, dataset: DatasetName) =>
  get<Sector[]>(`/api/sectors?${query(weights, dataset)}`);

/** Pipeline status for the live dataset: last refresh per source and which signal types are populated. */
export const fetchHealth = () => get<Health>('/api/health');
