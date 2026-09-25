import { loadDataset } from '@/lib/data';
import { scoreCompanies, weightsFromParams } from '@/lib/scoring';
import type { CompanyDetail } from '@/lib/types';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { companies, signals } = loadDataset();
  const weights = weightsFromParams(new URL(request.url).searchParams);

  // Score the whole set: percentile ranks only mean something relative to every other company.
  const company = scoreCompanies(companies, signals, weights).find((c) => c.id === id);
  if (!company) return Response.json({ error: 'Company not found' }, { status: 404 });

  const detail: CompanyDetail = { ...company, signals: signals.filter((s) => s.companyId === id) };
  return Response.json(detail);
}
