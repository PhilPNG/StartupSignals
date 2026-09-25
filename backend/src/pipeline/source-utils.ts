import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

export const RAW_DIR = path.join(process.cwd(), 'data', 'raw');

export class MissingInputError extends Error {}

export function localFiles(pattern: RegExp): string[] {
  return fs.readdirSync(RAW_DIR).filter((name) => pattern.test(name)).sort().map((name) => path.join(RAW_DIR, name));
}

export function parseTable(input: string, delimiter = ','): Record<string, string>[] {
  return parse(input.replace(/^\uFEFF/, ''), {
    columns: true,
    delimiter,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
  }) as Record<string, string>[];
}

export function field(row: Record<string, unknown>, ...names: string[]): string {
  const normalized = new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ''), value]));
  for (const name of names) {
    const value = normalized.get(name.toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

export function money(value: string): number | undefined {
  const cleaned = value.replace(/[$,]/g, '').trim();
  if (!cleaned || /^(indefinite|unknown|na|n\/a)$/i.test(cleaned)) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function isoDate(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

export async function fetchJson<T>(url: string, init: RequestInit = {}, attempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) throw new Error(`${response.status} ${url}`);
        throw new Error(`${response.status} ${url}: ${(await response.text()).slice(0, 200)}`);
      }
      return await response.json() as T;
    } catch (error) {
      if (attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
    }
  }
  throw new Error('Unreachable');
}
