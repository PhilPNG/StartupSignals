import { datasetFromParams, loadDataset } from '@/lib/data';
import { scoreCompanies, scoreSectors, weightsFromParams } from '@/lib/scoring';

export async function GET(request: Request) {
  try {
    const { companies, signals } = await loadDataset(datasetFromParams(new URL(request.url).searchParams));
    const weights = weightsFromParams(new URL(request.url).searchParams);
    return Response.json(scoreSectors(scoreCompanies(companies, signals, weights), signals), {
      headers: { 'X-Active-Signals': [...new Set(signals.map((s) => s.type))].join(',') },
    });
  } catch (error) {
    console.error('Sectors unavailable', error);
    return Response.json({ error: 'Sector data unavailable' }, { status: 503 });
  }
}
