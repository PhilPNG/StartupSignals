import { loadDataset } from '@/lib/data';
import { loadEnrichment } from '@/lib/enrichment';
import { scoreCompanies, weightsFromParams } from '@/lib/scoring';
import type { CompanyDetail } from '@/lib/types';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { companies, signals } = await loadDataset();
    const weights = weightsFromParams(new URL(request.url).searchParams);

    // Percentiles are relative to the whole published NJ company set.
    const company = scoreCompanies(companies, signals, weights).find((c) => c.id === id);
    if (!company) return Response.json({ error: 'Company not found' }, { status: 404 });

    // Sample records have no Supabase row to summarize.
    const ai = company.isSample ? null : await loadEnrichment(id);
    const detail: CompanyDetail = { ...company, signals: signals.filter((s) => s.companyId === id), ai };
    return Response.json(detail);
  } catch (error) {
    console.error('Company detail unavailable', error);
    return Response.json({ error: 'Company data unavailable' }, { status: 503 });
  }
}
