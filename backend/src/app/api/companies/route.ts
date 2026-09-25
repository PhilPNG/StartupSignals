import { loadDataset } from '@/lib/data';
import { scoreCompanies, weightsFromParams } from '@/lib/scoring';

export async function GET(request: Request) {
  try {
    const { companies, signals } = await loadDataset();
    const weights = weightsFromParams(new URL(request.url).searchParams);
    return Response.json(scoreCompanies(companies, signals, weights), {
      headers: { 'X-Active-Signals': [...new Set(signals.map((s) => s.type))].join(',') },
    });
  } catch (error) {
    console.error('Companies unavailable', error);
    return Response.json({ error: 'Company data unavailable' }, { status: 503 });
  }
}
