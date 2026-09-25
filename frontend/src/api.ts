import type { CompanyDetail, ScoredCompany, Sector, Weights } from './types';

function weightQuery(weights: Weights): string {
  return new URLSearchParams(Object.entries(weights).map(([k, v]) => [k, String(v)])).toString();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} (${path})`);
  return res.json() as Promise<T>;
}

export const fetchCompanies = (weights: Weights) =>
  get<ScoredCompany[]>(`/api/companies?${weightQuery(weights)}`);

export const fetchCompany = (id: string, weights: Weights) =>
  get<CompanyDetail>(`/api/companies/${encodeURIComponent(id)}?${weightQuery(weights)}`);

export const fetchSectors = (weights: Weights) => get<Sector[]>(`/api/sectors?${weightQuery(weights)}`);
