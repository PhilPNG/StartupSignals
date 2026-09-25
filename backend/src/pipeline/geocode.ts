import type { Company } from '../lib/types';

/**
 * Mapbox Geocoding v6 batch — up to 1,000 addresses per request (MAPBOX_TOKEN).
 * POST https://api.mapbox.com/search/geocode/v6/batch?access_token=…&permanent=true
 * We store the coordinates, so permanent=true is required. Check pricing first.
 */
export async function geocodeCompanies(companies: Company[]): Promise<void> {
  // TODO: batch addresses, set lat/lng in place; skip companies that already have coordinates.
  void companies;
}
