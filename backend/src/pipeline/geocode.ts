import type { Company } from '../lib/types';
import { parse } from 'csv-parse/sync';

type Feature = {
  properties?: {
    coordinates?: { longitude?: number; latitude?: number };
    match_code?: { confidence?: string };
    context?: { region?: { region_code?: string } };
  };
};
type BatchResponse = { batch?: { features?: Feature[] }[] };

const NJ_COUNTIES: Record<string, string> = {
  '001': 'Atlantic', '003': 'Bergen', '005': 'Burlington', '007': 'Camden',
  '009': 'Cape May', '011': 'Cumberland', '013': 'Essex', '015': 'Gloucester',
  '017': 'Hudson', '019': 'Hunterdon', '021': 'Mercer', '023': 'Middlesex',
  '025': 'Monmouth', '027': 'Morris', '029': 'Ocean', '031': 'Passaic',
  '033': 'Salem', '035': 'Somerset', '037': 'Sussex', '039': 'Union',
  '041': 'Warren',
};

/** Geocode only known NJ addresses, and retain only good NJ matches. */
export async function geocodeCompanies(companies: Company[]): Promise<void> {
  const token = process.env.MAPBOX_TOKEN;
  const pending = companies.filter((c) => (c.lat == null || c.lng == null || !c.county) && c.address && c.city);
  if (pending.length === 0) return;
  if (!token || process.env.MAPBOX_PERMANENT_GEOCODING_CONFIRMED !== 'true') {
    await censusGeocode(pending);
    return;
  }
  const missingCoordinates = pending.filter((c) => c.lat == null || c.lng == null);
  for (let start = 0; start < missingCoordinates.length; start += 1000) {
    const group = missingCoordinates.slice(start, start + 1000);
    const url = new URL('https://api.mapbox.com/search/geocode/v6/batch');
    url.searchParams.set('access_token', token);
    url.searchParams.set('permanent', 'true');
    const response = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(group.map((c) => ({ q: `${c.address}, ${c.city}, NJ, USA`, types: ['address'], country: 'US', limit: 1 }))),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Mapbox geocoding returned ${response.status}`);
    const data = await response.json() as BatchResponse;
    if (!data.batch || data.batch.length !== group.length) throw new Error('Mapbox batch result count does not match request');
    data.batch.forEach((result, index) => {
      const feature = result.features?.[0];
      const location = feature?.properties?.coordinates;
      const confidence = feature?.properties?.match_code?.confidence;
      const region = feature?.properties?.context?.region?.region_code;
      if (!location || !['exact', 'high'].includes(confidence ?? '') || region?.toUpperCase() !== 'NJ') return;
      const { latitude, longitude } = location;
      if (latitude == null || longitude == null || latitude < 38.8 || latitude > 41.5 || longitude < -75.7 || longitude > -73.7) return;
      group[index].lat = latitude;
      group[index].lng = longitude;
      group[index].geocodeConfidence = confidence;
    });
  }
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

/** Public Census batch geocoder; exact NJ matches only. */
async function censusGeocode(companies: Company[]): Promise<void> {
  const csv = companies.map((c) => [c.id, c.address, c.city, 'NJ', ''].map(csvCell).join(',')).join('\n');
  const form = new FormData();
  form.append('addressFile', new Blob([csv], { type: 'text/csv' }), 'addresses.csv');
  form.append('benchmark', 'Public_AR_Current');
  form.append('vintage', 'Current_Current');
  const response = await fetch('https://geocoding.geo.census.gov/geocoder/geographies/addressbatch', {
    method: 'POST', body: form, signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`Census geocoding returned ${response.status}`);
  const rows = parse(await response.text(), { relax_quotes: true, relax_column_count: true, skip_empty_lines: true }) as string[][];
  const byId = new Map(companies.map((c) => [c.id, c]));
  let matched = 0;
  for (const row of rows) {
    const company = byId.get(row[0]);
    if (!company || row[2]?.toLowerCase() !== 'match' || row[3]?.toLowerCase() !== 'exact') continue;
    if (!/,\s*NJ(?:,|$)/i.test(row[4] ?? '')) continue;
    const [lng, lat] = (row[5] ?? '').split(',').map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 38.8 || lat > 41.5 || lng < -75.7 || lng > -73.7) continue;
    company.lat = lat;
    company.lng = lng;
    company.geocodeConfidence = 'census-exact';
    if (row[8] === '34') company.county = NJ_COUNTIES[row[9]] ?? '';
    matched++;
  }
  console.log(`Census geocoded ${matched}/${companies.length} addresses`);
}
