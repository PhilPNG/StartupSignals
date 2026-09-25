import fs from 'node:fs';
import type { RawRecord } from '../types';
import { field, isoDate, localFiles, MissingInputError, parseTable } from '../source-utils';

export async function loadAccelerators(): Promise<RawRecord[]> {
  const file = localFiles(/^accelerators\.csv$/i)[0];
  if (!file) throw new MissingInputError('Add backend/data/raw/accelerators.csv to enable accelerators');
  return parseTable(fs.readFileSync(file, 'utf8')).flatMap((row): RawRecord[] => {
    const name = field(row, 'company', 'name');
    const city = field(row, 'city');
    const program = field(row, 'program');
    const date = isoDate(field(row, 'cohort_date', 'date'));
    const url = field(row, 'source_url');
    if (!name || !city || !program || !date || !url) return [];
    return [{ source: 'accelerator', externalId: `${name}:${program}:${date}`,
      name, city, state: 'NJ', signalType: 'accelerator',
      subtype: field(row, 'selective')?.toLowerCase() === 'yes' ? 'selective' : 'program',
      count: 1, date, sourceUrl: url, description: program, raw: row }];
  });
}
