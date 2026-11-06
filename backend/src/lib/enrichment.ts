import { database } from './supabase';
import type { CompanyAiEnrichment } from './types';

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

/**
 * The stored summary report for one company. It is optional context on the profile, so a
 * missing row, missing table, or Supabase error yields null rather than failing the request.
 */
export async function loadEnrichment(companyId: string): Promise<CompanyAiEnrichment | null> {
  try {
    const { data, error } = await database()
      .from('company_ai_enrichment')
      .select('summary, momentum_summary, key_signals, evidence_sources, generated_at')
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.summary) return null;
    return {
      summary: String(data.summary),
      momentumSummary: String(data.momentum_summary ?? ''),
      keySignals: strings(data.key_signals),
      evidenceSources: strings(data.evidence_sources),
      generatedAt: String(data.generated_at),
    };
  } catch (error) {
    console.warn(`Summary report unavailable for ${companyId}`, error);
    return null;
  }
}
