import OpenAI from 'openai';
import { SYSTEM_PROMPT } from './prompt';

/** Everything the model may use. Totals are computed here so the model never does arithmetic. */
export interface CompanyEvidence {
  asOfDate: string;
  company: {
    name: string;
    city: string;
    county: string;
    sector: string;
    industryGroup?: string;
    website?: string;
    foundedYear?: number;
  };
  metrics: {
    signalCount: number;
    signalsLast12Months: number;
    grantCount: number;
    totalGrantAmount: number;
    fundingCount: number;
    totalFundingAmount: number;
    latestSignalDate: string | null;
  };
  signals: {
    source: string;
    type: string;
    subtype?: string;
    amount?: number;
    date: string;
    description?: string;
  }[];
}

export interface CompanyAnalysis {
  summary: string;
  momentumSummary: string;
  keySignals: string[];
}

export const MODEL = process.env.OPENAI_MODEL || 'gpt-5.6';

let client: OpenAI | null = null;

export async function analyzeCompany(evidence: CompanyEvidence): Promise<CompanyAnalysis> {
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: MODEL,
    instructions: SYSTEM_PROMPT,
    input: JSON.stringify(evidence),
    text: {
      format: {
        type: 'json_schema',
        name: 'company_intelligence',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            momentumSummary: { type: 'string' },
            keySignals: { type: 'array', items: { type: 'string' }, maxItems: 4 },
          },
          required: ['summary', 'momentumSummary', 'keySignals'],
          additionalProperties: false,
        },
      },
    },
  });
  return JSON.parse(response.output_text) as CompanyAnalysis;
}
