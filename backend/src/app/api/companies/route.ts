import { loadDataset } from '@/lib/data';
import { scoreCompanies, weightsFromParams } from '@/lib/scoring';

export function GET(request: Request) {
  const { companies, signals } = loadDataset();
  const weights = weightsFromParams(new URL(request.url).searchParams);
  return Response.json(scoreCompanies(companies, signals, weights));
}
