import fs from 'node:fs';
import path from 'node:path';
import type { Dataset } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');

/** Pipeline output (data/companies.json) when it exists, otherwise the labeled sample set. */
export function loadDataset(): Dataset {
  for (const file of ['companies.json', 'sample-companies.json']) {
    const fullPath = path.join(DATA_DIR, file);
    if (fs.existsSync(fullPath)) return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as Dataset;
  }
  throw new Error(`No dataset found in ${DATA_DIR}`);
}
