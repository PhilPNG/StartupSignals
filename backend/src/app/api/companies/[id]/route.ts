import { loadDataset } from '@/lib/data';
import { scoreCompanies, weightsFromParams } from '@/lib/scoring';
import { supabase } from '@/lib/supabase';
import type { CompanyDetail } from '@/lib/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { companies, signals } = loadDataset();
  const weights = weightsFromParams(new URL(request.url).searchParams);

  // Score the whole set: percentile ranks only mean something
  // relative to every other company.
  const company = scoreCompanies(
    companies,
    signals,
    weights
  ).find((c) => c.id === id);

  if (!company) {
    return Response.json(
      { error: 'Company not found' },
      { status: 404 }
    );
  }

  const { data: ai, error: aiError } = await supabase
    .from('company_ai_enrichment')
    .select(`
      summary,
      momentum_summary,
      key_signals,
      evidence_sources,
      generated_at
    `)
    .eq('company_id', id)
    .maybeSingle();

  if (aiError) {
    console.error(
      `Failed to load AI enrichment for ${id}:`,
      aiError
    );
  }

  const detail: CompanyDetail = {
    ...company,

    signals: signals.filter(
      (s) => s.companyId === id
    ),

    ai: ai
      ? {
          summary: ai.summary,
          momentumSummary: ai.momentum_summary,
          keySignals: ai.key_signals ?? [],
          evidenceSources: ai.evidence_sources ?? [],
          generatedAt: ai.generated_at,
        }
      : null,
  };

  return Response.json(detail);
}